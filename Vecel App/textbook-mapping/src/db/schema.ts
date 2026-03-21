import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Subjects ───
export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const subjectsRelations = relations(subjects, ({ many }) => ({
  systemTopics: many(systemTopics),
}));

// ─── System Topics (your system's topics/sub-topics) ───
export const systemTopics = pgTable(
  'system_topics',
  {
    id: serial('id').primaryKey(),
    language: varchar('language', { length: 50 }).notNull(),
    grade: integer('grade').notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    term: integer('term').notNull(),
    topicName: varchar('topic_name', { length: 500 }).notNull(),
    submoduleName: text('submodule_name').notNull(),
    submoduleId: integer('submodule_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('unique_topic').on(
      table.language,
      table.grade,
      table.subjectId,
      table.submoduleId
    ),
  ]
);

export const systemTopicsRelations = relations(systemTopics, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [systemTopics.subjectId],
    references: [subjects.id],
  }),
  mappings: many(textbookMappings),
}));

// ─── Publishers ───
export const publishers = pgTable('publishers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const publishersRelations = relations(publishers, ({ many }) => ({
  mappings: many(textbookMappings),
}));

// ─── Textbook Mappings ───
export const textbookMappings = pgTable('textbook_mappings', {
  id: serial('id').primaryKey(),
  systemTopicId: integer('system_topic_id')
    .references(() => systemTopics.id)
    .notNull(),
  publisherId: integer('publisher_id')
    .references(() => publishers.id)
    .notNull(),
  textbookTopic: text('textbook_topic'),
  textbookTopicName: text('textbook_topic_name').notNull(),
  notes: text('notes'),
  createdBy: varchar('created_by', { length: 255 }),
  updatedBy: varchar('updated_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const textbookMappingsRelations = relations(textbookMappings, ({ one }) => ({
  systemTopic: one(systemTopics, {
    fields: [textbookMappings.systemTopicId],
    references: [systemTopics.id],
  }),
  publisher: one(publishers, {
    fields: [textbookMappings.publisherId],
    references: [publishers.id],
  }),
}));

// ─── Missing Textbook Topics (topics in textbooks but not in our system) ───
export const missingTextbookTopics = pgTable('missing_textbook_topics', {
  id: serial('id').primaryKey(),
  publisherId: integer('publisher_id')
    .references(() => publishers.id)
    .notNull(),
  grade: integer('grade').notNull(),
  subjectId: integer('subject_id')
    .references(() => subjects.id)
    .notNull(),
  term: integer('term').notNull(),
  topic: text('topic').notNull(),
  subTopic: text('sub_topic'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const missingTextbookTopicsRelations = relations(missingTextbookTopics, ({ one }) => ({
  publisher: one(publishers, {
    fields: [missingTextbookTopics.publisherId],
    references: [publishers.id],
  }),
  subject: one(subjects, {
    fields: [missingTextbookTopics.subjectId],
    references: [subjects.id],
  }),
}));

// ─── Users ───
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
