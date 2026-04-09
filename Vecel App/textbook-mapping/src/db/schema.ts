import { pgTable, serial, integer, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const publishers = pgTable('publishers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});

export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});

export const systemTopics = pgTable('system_topics', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  subjectId: integer('subject_id').references(() => subjects.id),
});

export const textbookMappings = pgTable('textbook_mappings', {
  id: serial('id').primaryKey(),
  publisherId: integer('publisher_id').notNull().references(() => publishers.id),
  systemTopicId: integer('system_topic_id').notNull().references(() => systemTopics.id),
  textbookTopic: text('textbook_topic'),
  textbookTopicName: text('textbook_topic_name').notNull(),
  notes: text('notes'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow(),
  source: varchar('source', { length: 20 }).default('manual'),
});