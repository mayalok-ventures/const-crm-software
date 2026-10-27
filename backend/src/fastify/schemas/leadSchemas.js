const { z } = require('zod');

const leadCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().min(5, 'Phone must be at least 5 digits').max(20),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  company: z.string().optional(),
  location: z.string().optional(),
  targetStream: z.string().optional(),
  targetDomain: z.string().optional(),
  targetCourse: z.string().optional(),
  targetState: z.string().optional(),
  targetCity: z.string().optional(),
  academicScore: z.union([z.string(), z.number()]).optional(),
  academicScore10th: z.number().optional().nullable(),
  academicScore12th: z.number().optional().nullable(),
  academicScoreGrad: z.number().optional().nullable(),
  entranceExam: z.string().optional(),
  entranceRank: z.string().optional(),
  quotaPreference: z.string().optional(),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  score: z.number().min(0).max(100).optional(),
  status: z.string().optional(),
  pipelineStage: z.string().optional(),
  source: z.string().optional(),
  budget: z.string().optional(),
  packageBudget: z.string().optional(),
  closedDealAmount: z.number().optional().nullable(),
  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),
  followUpDate: z.union([z.string(), z.date()]).optional().nullable(),
  followUpNote: z.string().optional(),
  customData: z.record(z.any()).optional(),
}).passthrough();

const leadUpdateSchema = leadCreateSchema.partial().extend({
  version: z.number().optional(),
  lostReason: z.string().optional(),
  lostRemarks: z.string().optional(),
  lostReasonDetail: z.string().optional(),
  campusVisitDate: z.string().datetime().optional().nullable(),
  tokenAdvancePaid: z.number().min(0).optional(),
  admissionFinalFee: z.number().min(0).optional(),
}).passthrough();

const leadQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(250).default(50),
  status: z.string().optional(),
  stage: z.string().optional(),
  assignedTo: z.string().optional(),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  search: z.string().optional(),
  source: z.string().optional(),
  sortBy: z.string().default('_id'),
  sortOrder: z.coerce.number().default(-1),
});

module.exports = {
  leadCreateSchema,
  leadUpdateSchema,
  leadQuerySchema,
};
