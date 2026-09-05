import crypto from 'crypto';
import { Complaint } from '../models/Complaint.js';
import { SuspiciousActivity } from '../models/SuspiciousActivity.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/response.js';
import { generateIdWithRetry, VALID_STATUSES } from '../utils/complaint.utils.js';
import { Notification } from '../models/Notification.js';
import { extractTextFromPdf } from '../utils/pdf_ocr.js';
import {
  processAndStore,
  safeCleanRaw,
} from './file.service.js';
import { sendComplaintEmail } from './email.service.js';

/* ══════════════════════════════════════════════════════
   EMAIL — fire-and-forget student notification.
   Only sends when the user has an email, hasn't opted out,
   and the complaint is not anonymous. Never throws.
══════════════════════════════════════════════════════ */
async function notifyStudentByEmail({ complaintUserId, referenceId, title, status, feedback, actionLabel }) {
  try {
    if (!complaintUserId) return;
    const user = await User.findById(complaintUserId).select('email settings name').lean();
    if (!user || !user.email) return;
    if (user.settings?.email_notifications === false) return;

    await sendComplaintEmail({
      to: user.email,
      name: user.name,
      referenceId,
      title,
      status,
      feedback,
      actionLabel,
    });
  } catch (err) {
    console.error('[email] notifyStudentByEmail error:', err.message);
  }
}

/* ══════════════════════════════════════════════════════
   EMAIL — fire-and-forget staff notification.
   Sends when a complaint is assigned to a staff member
   or when a case they own is updated. Never throws.
══════════════════════════════════════════════════════ */
async function notifyStaffByEmail({ staffId, referenceId, title, status, feedback, actionLabel }) {
  try {
    if (!staffId) return;
    const staff = await User.findById(staffId).select('email settings name').lean();
    if (!staff || !staff.email) return;
    if (staff.settings?.email_notifications === false) return;

    await sendComplaintEmail({
      to: staff.email,
      name: staff.name,
      referenceId,
      title,
      status,
      feedback,
      actionLabel,
    });
  } catch (err) {
    console.error('[email] notifyStaffByEmail error:', err.message);
  }
}

export const complaintService = {

  /* ══════════════════════════════════════════════════════
     CREATE
  ══════════════════════════════════════════════════════ */
  async create({ userId, category, title, description, anonymous, priority = 'normal', files = [], department }) {
    let referenceId;

    try {
      referenceId = await generateIdWithRetry();

      const attachedFiles = await processAndStore(files);

      // Run Python OCR on attached PDFs
      let extractedText = "";
      for (const file of attachedFiles) {
        if (file.mimeType === 'application/pdf') {
          // Construct absolute path using url or fallback
          const filePath = file.path || `src/uploads/compressed/${file.filename}`;
          const text = await extractTextFromPdf(filePath);
          if (text) {
            extractedText += `\n\n[OCR from ${file.originalName}]:\n${text}`;
          }
        }
      }

      const finalDescription = (description + extractedText).trim();

      // System Auto-Assignment Logic
      let assignedStaffId = null;
      let assignedStaffName = '';
      let matchedDepartment = null;

      const { Department } = await import('../models/Department.js');
      const user = await User.findById(userId).select('department_id').lean();
      const isAcademic = ['academic-result', 'academic-lecturer'].includes(category);

      if (isAcademic && user && user.department_id) {
        matchedDepartment = await Department.findById(user.department_id).lean();
      }

      if (!matchedDepartment) {
        matchedDepartment = await Department.findOne({
          categories: category
        }).lean();
      }

      if (!matchedDepartment) {
        matchedDepartment = await Department.findOne({
          categories: 'other'
        }).lean();
      }

      if (matchedDepartment) {
        const staffInDept = await User.find({
          role: 'staff',
          department_id: matchedDepartment._id
        }).select('_id name').lean();

        if (staffInDept.length > 0) {
          const staffIds = staffInDept.map(s => s._id);
          const workloads = await Complaint.aggregate([
            {
              $match: {
                assigned_staff_id: { $in: staffIds },
                status: { $in: ['pending', 'in_review'] }
              }
            },
            {
              $group: {
                _id: '$assigned_staff_id',
                count: { $sum: 1 }
              }
            }
          ]);

          const workloadMap = workloads.reduce((acc, curr) => {
            acc[curr._id.toString()] = curr.count;
            return acc;
          }, {});

          let selectedStaff = staffInDept[0];
          let minWorkload = workloadMap[selectedStaff._id.toString()] || 0;

          for (const s of staffInDept) {
            const load = workloadMap[s._id.toString()] || 0;
            if (load < minWorkload) {
              minWorkload = load;
              selectedStaff = s;
            }
          }

          assignedStaffId = selectedStaff._id;
          assignedStaffName = selectedStaff.name;
        } else if (matchedDepartment.head_id) {
          const headUser = await User.findById(matchedDepartment.head_id).select('_id name').lean();
          if (headUser) {
            assignedStaffId = headUser._id;
            assignedStaffName = headUser.name;
          }
        }
      }

      const timeline = [{
        type: 'system',
        text: 'Complaint submitted and reference ID issued.',
        user_id: userId
      }];

      if (assignedStaffId) {
        timeline.push({
          type: 'assigned',
          text: `System automatically assigned this case to Staff Member ${assignedStaffName} (Department: ${matchedDepartment?.name || 'General'}).`
        });
      }

      const newComplaint = await Complaint.create({
        reference_id: referenceId,
        user_id: userId,
        category,
        title: title.trim(),
        description: finalDescription,
        anonymous: anonymous ? true : false,
        priority,
        status: 'pending',
        files: attachedFiles,
        assigned_staff_id: assignedStaffId,
        timeline
      });
      
      // Asynchronously generate an AI draft reply
      import('./ai.service.js').then(({ aiService }) => {
        aiService.analyzeComplaint(finalDescription).then(async (analysis) => {
          if (analysis && analysis.suggestedResponse) {
            newComplaint.ai_draft_reply = analysis.suggestedResponse;
            await newComplaint.save();
          }
        }).catch(err => console.error("AI Draft Generation failed:", err));
      });

      // Email the student a receipt with their reference ID (non-blocking)
      if (!anonymous) {
        notifyStudentByEmail({
          complaintUserId: userId,
          referenceId,
          title: title.trim(),
          status: 'pending',
        });
      }

      // Email the assigned staff member about the new case (non-blocking)
      if (assignedStaffId) {
        notifyStaffByEmail({
          staffId: assignedStaffId,
          referenceId,
          title: title.trim(),
          status: 'pending',
          actionLabel: 'A new complaint has been assigned to you',
        });
      }

      return {
        id:          newComplaint._id.toString(),
        referenceId,
        filesCount:  newComplaint.files.length,
        files:       newComplaint.files,
      };

    } catch (err) {
      await safeCleanRaw(files);
      throw err;
    }
  },

  /* ══════════════════════════════════════════════════════
     GET BY USER
  ══════════════════════════════════════════════════════ */
  async getByUser(userId) {
    const complaints = await Complaint.find({ user_id: userId })
      .select('reference_id category title status priority anonymous files admin_feedback satisfaction_feedback created_at updated_at')
      .sort({ created_at: -1 })
      .lean();

    return complaints.map(c => ({
      _id: c._id.toString(),
      reference_id: c.reference_id,
      category: c.category,
      title: c.title,
      status: c.status,
      priority: c.priority,
      anonymous: c.anonymous,
      admin_feedback: c.admin_feedback || '',
      satisfaction_feedback: c.satisfaction_feedback || null,
      created_at: c.created_at,
      updated_at: c.updated_at,
      file_count: c.files ? c.files.length : 0,
    }));
  },

  /* ══════════════════════════════════════════════════════
     GET ONE
  ══════════════════════════════════════════════════════ */
  async getById(identifier, userId, role) {
    const isRef = typeof identifier === 'string' && identifier.startsWith('CMP-');

    const query = isRef ? { reference_id: identifier } : { _id: identifier };
    const complaint = await Complaint.findOne(query)
      .populate('internal_notes.admin_id', 'name')
      .populate('timeline.user_id', 'name role')
      .populate('assigned_staff_id', 'name email')
      .lean();

    if (!complaint) {
      throw new AppError(
        `Complaint ${isRef ? identifier : `#${identifier}`} not found.`,
        404,
      );
    }

    const isOwner = complaint.user_id?.toString() === userId;
    const staffId = complaint.assigned_staff_id?._id || complaint.assigned_staff_id;
    const isAssignedStaff = staffId?.toString() === userId;

    if (role === 'staff') {
      if (!isAssignedStaff && !isOwner) {
        throw new AppError('Complaint not found.', 404);
      }
    } else if (role !== 'admin' && role !== 'superadmin') {
      if (!isOwner) {
        throw new AppError('Complaint not found.', 404);
      }
    }

    let submitter = null;
    if (complaint.user_id) {
      if (!complaint.anonymous || complaint.user_id.toString() === userId) {
        submitter = await User.findById(complaint.user_id)
          .select('name matric email')
          .lean();
        if (submitter) {
          submitter.id = submitter._id.toString();
          delete submitter._id;
        }
      } else {
        const hash = crypto.createHash('md5').update(complaint.user_id.toString()).digest('hex').substring(0, 6).toUpperCase();
        submitter = {
          id: complaint.user_id.toString(),
          name: `Anonymous Student (${hash})`,
          matric: `ANON-${hash}`,
          email: null
        };
      }
    }

    return {
      id:             complaint._id.toString(),
      referenceId:    complaint.reference_id,
      category:       complaint.category,
      title:          complaint.title,
      description:    complaint.description,
      status:         complaint.status,
      priority:       complaint.priority,
      anonymous:      complaint.anonymous,
      adminFeedback:  complaint.admin_feedback || '',
      aiDraftReply:   complaint.ai_draft_reply || null,
      satisfactionFeedback: complaint.satisfaction_feedback || null,
      assignedStaff: complaint.assigned_staff_id ? {
        id: complaint.assigned_staff_id._id.toString(),
        name: complaint.assigned_staff_id.name,
        email: complaint.assigned_staff_id.email
      } : null,
      submitter,
      files:          complaint.files || [],
      internalNotes:  complaint.internal_notes || [],
      timeline:       (complaint.timeline || []).map(t => {
        const showUser = t.user_id && (!complaint.anonymous || t.user_id.role === 'admin');
        return {
          type: t.type,
          text: t.text,
          user_id: showUser ? t.user_id : null,
          created_at: t.created_at,
        };
      }),
      createdAt:      complaint.created_at,
      updatedAt:      complaint.updated_at,
    };
  },

  /* ══════════════════════════════════════════════════════
     TRACKING (Public)
  ══════════════════════════════════════════════════════ */
  async trackByReference(referenceId) {
    const complaint = await Complaint.findOne({ reference_id: referenceId.trim().toUpperCase() })
      .select('reference_id category title status anonymous admin_feedback satisfaction_feedback timeline created_at updated_at')
      .populate('timeline.user_id', 'name role')
      .lean();

    if (!complaint) {
      throw new AppError(`No complaint found with reference ID ${referenceId}.`, 404);
    }

    return {
      reference_id:  complaint.reference_id,
      category:     complaint.category,
      title:        complaint.title,
      status:       complaint.status,
      anonymous:    complaint.anonymous,
      admin_feedback: complaint.admin_feedback || '',
      satisfaction_feedback: complaint.satisfaction_feedback || null,
      timeline:     (complaint.timeline || []).map(t => {
        const showUser = t.user_id && (!complaint.anonymous || t.user_id.role === 'admin');
        return {
          type: t.type,
          text: t.text,
          user_id: showUser ? t.user_id : null,
          created_at: t.created_at,
        };
      }),
      created_at:  complaint.created_at,
      updated_at:  complaint.updated_at,
    };
  },

  /* ══════════════════════════════════════════════════════
     ADMIN — paginated list
  ══════════════════════════════════════════════════════ */
  async getAll({ status, category, priority, page = 1, limit = 50, userRole, userDepartment, userId } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    // Staff can only see complaints assigned to them
    if (userRole === 'staff') {
      filter.assigned_staff_id = userId;
    } else {
      // Admins/Superadmins can filter freely
      if (category) filter.category = category;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const complaints = await Complaint.find(filter)
      .populate('user_id', 'name matric')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Complaint.countDocuments(filter);

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 50;
    const pages = Math.ceil(total / limitNum) || 1;

    return {
      complaints: complaints.map(c => {
        let user_name = null;
        let matric = null;
        if (c.user_id) {
          if (!c.anonymous) {
            user_name = c.user_id.name;
            matric = c.user_id.matric;
          } else {
            const hash = crypto.createHash('md5').update(c.user_id._id.toString()).digest('hex').substring(0, 6).toUpperCase();
            user_name = `Anonymous Student (${hash})`;
            matric = `ANON-${hash}`;
          }
        }
        return {
          _id: c._id.toString(),
          reference_id: c.reference_id,
          category: c.category,
          title: c.title,
          status: c.status,
          priority: c.priority,
          anonymous: c.anonymous,
          created_at: c.created_at,
          updated_at: c.updated_at,
          user_name,
          matric,
          file_count: c.files ? c.files.length : 0,
        };
      }),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages,
      },
    };
  },

  /* ══════════════════════════════════════════════════════
     UPDATE STATUS
  ══════════════════════════════════════════════════════ */
  async updateStatus(id, status, adminId, adminFeedback = '') {
    if (!VALID_STATUSES.has(status)) {
      throw new AppError(`Invalid status "${status}".`, 400);
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) throw new AppError('Complaint not found.', 404);

    const oldStatus = complaint.status;
    complaint.status = status;
    
    let timelineText = `Status changed from ${oldStatus.replace('_', ' ')} to ${status.replace('_', ' ')}.`;
    if (adminFeedback && adminFeedback.trim() !== '') {
      complaint.admin_feedback = adminFeedback.trim();
      timelineText += ` Official reply: "${adminFeedback.trim()}"`;
    }
    
    complaint.timeline.push({
      type: 'status_change',
      text: timelineText,
      user_id: adminId
    });

    await complaint.save();

    // Notify student privately even if anonymous
    if (complaint.user_id) {
      await Notification.create({
        recipient_id: complaint.user_id,
        title: 'Case Status Updated',
        message: `Your case #${complaint.reference_id} status has been changed to ${status.replace('_', ' ')}.${adminFeedback && adminFeedback.trim() !== '' ? ' Reply: ' + adminFeedback.trim() : ''}`,
        type: 'status_update',
        reference_link: `/track?id=${complaint.reference_id}`
      });
    }

    // Email the student about the status change (non-blocking)
    if (!complaint.anonymous) {
      notifyStudentByEmail({
        complaintUserId: complaint.user_id,
        referenceId: complaint.reference_id,
        title: complaint.title,
        status,
        feedback: adminFeedback && adminFeedback.trim() !== '' ? adminFeedback.trim() : '',
        actionLabel: `Your case status has changed to ${status.replace('_', ' ')}`,
      });
    }

    // Email the assigned staff about the status change (non-blocking)
    if (complaint.assigned_staff_id) {
      notifyStaffByEmail({
        staffId: complaint.assigned_staff_id,
        referenceId: complaint.reference_id,
        title: complaint.title,
        status,
        feedback: adminFeedback && adminFeedback.trim() !== '' ? adminFeedback.trim() : '',
        actionLabel: `Case #${complaint.reference_id} status changed to ${status.replace('_', ' ')}`,
      });
    }

    return { id: complaint._id.toString(), status: complaint.status };
  },

  /* ══════════════════════════════════════════════════════
     ADD INTERNAL NOTE
  ══════════════════════════════════════════════════════ */
  async addInternalNote(id, adminId, text) {
    const complaint = await Complaint.findById(id);
    if (!complaint) throw new AppError('Complaint not found.', 404);

    complaint.internal_notes.push({
      admin_id: adminId,
      text: text.trim()
    });

    complaint.timeline.push({
      type: 'note_added',
      text: 'Internal note added by administrator.',
      user_id: adminId
    });

    await complaint.save();

    return complaint.internal_notes[complaint.internal_notes.length - 1];
  },

  /* ══════════════════════════════════════════════════════
     UPDATE PRIORITY
  ══════════════════════════════════════════════════════ */
  async updatePriority(id, priority, adminId) {
    const validPriorities = ['low', 'normal', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      throw new AppError('Invalid priority.', 400);
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) throw new AppError('Complaint not found.', 404);

    const oldPriority = complaint.priority;
    complaint.priority = priority;

    complaint.timeline.push({
      type: 'system',
      text: `Priority updated from ${oldPriority} to ${priority}.`,
      user_id: adminId
    });

    await complaint.save();
    return { id: complaint._id.toString(), priority: complaint.priority };
  },

  /* ══════════════════════════════════════════════════════
     GET ADMIN STATS
  ══════════════════════════════════════════════════════ */
  async getStats() {
    const [counts, byCategory, feedbackSummary, recentFeedbacks] = await Promise.all([
      Complaint.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Complaint.aggregate([
        { $group: { _id: '$category', open: { $sum: { $cond: [{ $in: ['$status', ['pending', 'in_review']] }, 1, 0] } }, resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'fixed']] }, 1, 0] } } } }
      ]),
      Complaint.aggregate([
        { $match: { 'satisfaction_feedback.rating': { $ne: null } } },
        { 
          $group: { 
            _id: null, 
            avgRating: { $avg: '$satisfaction_feedback.rating' },
            totalFeedback: { $sum: 1 },
            satisfied: { $sum: { $cond: [{ $eq: ['$satisfaction_feedback.satisfied', 'yes'] }, 1, 0] } },
            r5: { $sum: { $cond: [{ $eq: ['$satisfaction_feedback.rating', 5] }, 1, 0] } },
            r4: { $sum: { $cond: [{ $eq: ['$satisfaction_feedback.rating', 4] }, 1, 0] } },
            r3: { $sum: { $cond: [{ $eq: ['$satisfaction_feedback.rating', 3] }, 1, 0] } },
            r2: { $sum: { $cond: [{ $eq: ['$satisfaction_feedback.rating', 2] }, 1, 0] } },
            r1: { $sum: { $cond: [{ $eq: ['$satisfaction_feedback.rating', 1] }, 1, 0] } }
          }
        }
      ]),
      Complaint.find(
        { 'satisfaction_feedback.rating': { $ne: null } },
        { title: 1, reference_id: 1, anonymous: 1, user_id: 1, satisfaction_feedback: 1, category: 1 }
      )
      .sort({ 'satisfaction_feedback.submitted_at': -1 })
      .limit(10)
      .populate('user_id', 'name')
      .lean()
    ]);

    const feedbackStats = feedbackSummary[0] || {
      avgRating: 0,
      totalFeedback: 0,
      satisfied: 0,
      r5: 0,
      r4: 0,
      r3: 0,
      r2: 0,
      r1: 0
    };

    return {
      statusCounts: counts.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
      categoryStats: byCategory,
      feedbackStats: {
        avgRating: feedbackStats.avgRating ? Number(feedbackStats.avgRating.toFixed(1)) : 0,
        totalFeedback: feedbackStats.totalFeedback || 0,
        satisfiedCount: feedbackStats.satisfied || 0,
        ratingsDistribution: {
          5: feedbackStats.r5 || 0,
          4: feedbackStats.r4 || 0,
          3: feedbackStats.r3 || 0,
          2: feedbackStats.r2 || 0,
          1: feedbackStats.r1 || 0
        }
      },
      recentFeedbacks: recentFeedbacks.map(f => ({
        id: f._id.toString(),
        referenceId: f.reference_id,
        title: f.title,
        category: f.category,
        anonymous: f.anonymous,
        studentName: f.anonymous ? 'Anonymous Student' : (f.user_id?.name || 'Student'),
        rating: f.satisfaction_feedback.rating,
        satisfied: f.satisfaction_feedback.satisfied,
        comments: f.satisfaction_feedback.comments,
        submittedAt: f.satisfaction_feedback.submitted_at
      }))
    };
  },

  async submitSatisfactionFeedback(id, { satisfied, rating, comments }, userId) {
    const complaint = await Complaint.findById(id);
    if (!complaint) throw new AppError('Complaint not found.', 404);

    // Security check: only the submitter of the complaint can rate it (if authenticated)
    if (complaint.user_id && complaint.user_id.toString() !== userId.toString()) {
      throw new AppError('Unauthorized to submit feedback for this complaint.', 403);
    }

    // Business rule: can only rate resolved or fixed complaints
    if (complaint.status !== 'resolved' && complaint.status !== 'fixed') {
      throw new AppError('Satisfaction feedback can only be submitted for resolved or fixed complaints.', 400);
    }

    let finalRating = rating ? Number(rating) : null;
    let finalSatisfied = satisfied;

    if (finalRating) {
      if (finalRating < 1 || finalRating > 5) {
        throw new AppError('Rating must be between 1 and 5.', 400);
      }
      if (!finalSatisfied) {
        finalSatisfied = finalRating >= 4 ? 'yes' : 'no';
      }
    } else if (finalSatisfied) {
      finalRating = finalSatisfied === 'yes' ? 5 : 2;
    }

    complaint.satisfaction_feedback = {
      satisfied: finalSatisfied === 'yes' ? 'yes' : 'no',
      rating: finalRating,
      comments: (comments || '').trim(),
      submitted_at: new Date()
    };

    complaint.timeline.push({
      type: 'system',
      text: `Satisfaction feedback submitted: Rating of ${finalRating}/5 (${finalSatisfied === 'yes' ? 'Satisfied' : 'Not Satisfied'}).${comments ? ' Comments: ' + comments : ''}`,
      user_id: userId
    });

    await complaint.save();

    return {
      id: complaint._id.toString(),
      satisfactionFeedback: complaint.satisfaction_feedback
    };
  },

  async countRecentByUserId(userId, minutes) {
    const cutoff = new Date(Date.now() - minutes * 60000);
    return Complaint.countDocuments({
      user_id: userId,
      created_at: { $gte: cutoff },
    });
  },

  async logActivity({ userId, activityType, details, severity = 'low' }) {
    await SuspiciousActivity.create({
      user_id: userId,
      activity_type: activityType,
      details,
      severity,
    });
  },
};
