import { z } from "zod";

const tag = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9-]+$/, "tags use lowercase letters, numbers and dashes");

export const linkInputSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(120),
  url: z.url({ protocol: /^https?$/, error: "url must be an http(s) URL" }).max(2048),
  tags: z
    .array(tag)
    .max(8)
    .default([])
    .transform((tags) => [...new Set(tags)]),
});

export const linkSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  url: z.string(),
  tags: z.array(z.string()),
  createdAt: z.iso.datetime(),
});

export const dataFileSchema = z.object({
  version: z.literal(1),
  links: z.array(linkSchema),
});

export type LinkInput = z.input<typeof linkInputSchema>;
export type Link = z.infer<typeof linkSchema>;
export type DataFile = z.infer<typeof dataFileSchema>;
