/** Select fragment for PostgREST — לוקאפים מקושרים לתלמידה */
export const STUDENT_WITH_LOOKUPS = `
  *,
  grade_levels ( id, name ),
  classes ( id, name ),
  specializations ( id, name ),
  tracks ( id, name )
`;
