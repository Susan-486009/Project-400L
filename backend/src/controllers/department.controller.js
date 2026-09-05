import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { Department } from '../models/Department.js';
import { AppError } from '../utils/response.js';

export const getAllDepartments = asyncHandler(async (req, res) => {
  const depts = await Department.find({ is_active: true }).populate('head_id', 'name email').lean();
  sendSuccess(res, depts);
});

export const createDepartment = asyncHandler(async (req, res) => {
  const { name, description, head_id, categories } = req.body;
  
  const existing = await Department.findOne({ name });
  if (existing) throw new AppError('Department already exists.', 400);

  const dept = await Department.create({ name, description, head_id, categories: categories || [] });
  sendSuccess(res, dept, 'Department created successfully.', 201);
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!dept) throw new AppError('Department not found.', 404);
  sendSuccess(res, dept, 'Department updated successfully.');
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findByIdAndUpdate(req.params.id, { is_active: false });
  if (!dept) throw new AppError('Department not found.', 404);
  sendSuccess(res, null, 'Department deactivated successfully.');
});
