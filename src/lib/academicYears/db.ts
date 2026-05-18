export const STUDENT_WITH_LOOKUPS = `
  *,
  classes ( id, name ),
  specializations:specializations!students_specialization_id_fkey ( id, name ),
  secondary_specializations:specializations!students_secondary_specialization_id_fkey ( id, name ),
  tracks ( id, name )
`;

export async function getStudentWithLookupsSelect() {
  return STUDENT_WITH_LOOKUPS;
}

export const ASSIGNMENT_WITH_LOOKUPS = `
  *,
  teachers ( id, name )
`;
