export const STUDENT_WITH_LOOKUPS = `
  *,
  classes ( id, name ),
  specializations ( id, name ),
  tracks ( id, name )
`;

export async function getStudentWithLookupsSelect(): Promise<string> {
  return STUDENT_WITH_LOOKUPS;
}
