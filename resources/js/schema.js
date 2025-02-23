import { z } from "zod";
export const ProfileUpdateRequest = z.object({
  name: z.coerce.string().max(255),
  email: z.coerce.string().email().max(255),
});
export const UserRequest = z.object({
  name: z.coerce.string().min(3).max(255),
  email: z.coerce.string().email(),
  username: z.coerce.string(),
  gender: z.coerce.string().nullable().optional(),
  birthdate: z.coerce.date().nullable().optional(),
  phone: z.coerce.string().nullable().optional(),
  roles: z.array(z.coerce.string()),
});
export const RoleRequest = z.object({
  rules: z.array(
    z.object({
      permission_id: z.coerce.string(),
      level: z.coerce.number().int(),
      only_creator: z.coerce.boolean(),
      permissions: z.coerce.string(),
    }),
  ),
});
export const TagRequest = z.object({
  name: z.coerce.string().max(255).min(3),
  isNew: z.coerce.boolean().nullable().optional(),
});
export const CommentRequest = z.object({
  comment: z.coerce.string().min(3),
});
export const LoginRequest = z.object({
  usernameOrEmail: z.coerce.string(),
  password: z.coerce.string(),
});
