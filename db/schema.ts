import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const profiles = sqliteTable('profiles', { id:text('id').primaryKey(), name:text('name').notNull() });
export const rooms = sqliteTable('rooms', { id:text('id').primaryKey(), owner:text('owner').notNull(), title:text('title').notNull(), open:integer('open').notNull().default(1) });
export const entries = sqliteTable('entries', { id:text('id').primaryKey(), room:text('room').notNull(), user:text('user').notNull(), name:text('name').notNull(), status:text('status').notNull(), joined:integer('joined').notNull(), acceptedBy:text('accepted_by'), admittedAt:integer('admitted_at') });

export const tickets = sqliteTable('tickets', { number:integer('number').primaryKey({autoIncrement:true}), entry:text('entry').notNull().unique() });
