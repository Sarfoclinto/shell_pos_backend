/**
 * Migration 004: Alter schema 2
 *
 * 1. Add img columns to user table
 *
 */
export const up = async (query) => {
  // -- 1. Add img column to users
  await query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS img VARCHAR(300)
    `);
};

export const down = async (query) => {
  // -- 1. Remove img column from users
  await query(`
        ALTER TABLE users
        DROP COLUMN IF EXISTS img
    `);
};
