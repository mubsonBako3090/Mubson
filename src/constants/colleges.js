// KASU's 8 colleges, with their faculties and departments.
// Department lists below are seeded with the examples confirmed so far —
// expand each `departments` array with the full official list when available.
//
// `routingType` tells lib/routing.js which approval chain to use:
//   "standard"     -> HOD -> Dean -> Provost -> VC
//   "postgraduate" -> Postgraduate Programme Coordinator -> Provost of Postgraduate Studies -> VC
//   "basicStudies" -> Coordinator/Lecturer-in-Charge -> Director of Basic Studies -> VC

export const COLLEGES = [
  {
    id: "medicine",
    name: "College of Medicine",
    routingType: "standard",
    faculties: [
      {
        id: "basic-medical-sciences",
        name: "Faculty of Basic Medical Sciences",
        departments: ["Human Anatomy", "Human Physiology", "Medical Biochemistry"],
      },
      {
        id: "basic-clinical-sciences",
        name: "Faculty of Basic Clinical Sciences",
        departments: ["Chemical Pathology", "Community Medicine"],
      },
      {
        id: "clinical-sciences",
        name: "Faculty of Clinical Sciences",
        departments: ["Surgery"],
      },
    ],
  },
  {
    id: "science-computing-engineering",
    name: "College of Science, Computing and Engineering",
    routingType: "standard",
    faculties: [
      {
        id: "science",
        name: "Faculty of Science",
        departments: ["Biological Sciences", "Biochemistry", "Microbiology", "Chemistry", "Physics", "Mathematical Sciences"],
      },
      {
        id: "computing",
        name: "Faculty of Computing",
        departments: ["Computer Science"],
      },
      {
        id: "engineering",
        name: "Faculty of Engineering",
        departments: ["Computer Engineering", "Electrical & Electronics Engineering"],
      },
    ],
  },
  {
    id: "communications-management-social-sciences",
    name: "College of Communications, Management and Social Sciences",
    routingType: "standard",
    faculties: [
      {
        id: "social-sciences",
        name: "Faculty of Social Sciences",
        departments: ["Economics", "Political Science", "Sociology", "Geography", "Mass Communication"],
      },
      {
        id: "management-sciences",
        name: "Faculty of Management Sciences",
        departments: ["Accounting", "Business Administration", "Banking & Finance", "Public Administration"],
      },
    ],
  },
  {
    id: "humanities-education-law",
    name: "College of Humanities, Education, and Law",
    routingType: "standard",
    faculties: [
      {
        id: "arts",
        name: "Faculty of Arts",
        departments: ["English and Drama", "History", "Arabic", "Islamic Studies", "Christian Religious Studies"],
      },
      {
        id: "education",
        name: "Faculty of Education",
        departments: ["Science Education", "Arts Education"],
      },
      {
        id: "law",
        name: "Faculty of Law",
        departments: ["Law"],
      },
    ],
  },
  {
    id: "agriculture-environmental-sciences",
    name: "College of Agriculture and Environmental Sciences",
    routingType: "standard",
    faculties: [
      {
        id: "agriculture",
        name: "Faculty of Agriculture",
        departments: ["Agricultural Economics", "Animal Science", "Crop Protection"],
      },
      {
        id: "environmental-sciences",
        name: "Faculty of Environmental Sciences",
        departments: ["Architecture", "Estate Management", "Quantity Surveying", "Environmental Management"],
      },
    ],
  },
  {
    id: "allied-health-pharmaceutical-sciences",
    name: "College of Allied Health and Pharmaceutical Sciences",
    routingType: "standard",
    faculties: [
      {
        id: "allied-health-sciences",
        name: "Faculty of Allied Health Sciences",
        departments: ["Nursing Science", "Medical Laboratory Science", "Physiotherapy", "Radiography"],
      },
      {
        id: "pharmaceutical-sciences",
        name: "Faculty of Pharmaceutical Sciences",
        departments: ["Pharmacy"],
      },
    ],
  },
  {
    id: "postgraduate-studies",
    name: "College of Postgraduate Studies",
    routingType: "postgraduate",
    faculties: [
      {
        id: "postgraduate-programmes",
        name: "Postgraduate Programmes",
        departments: ["Postgraduate Studies"],
      },
    ],
  },
  {
    id: "basic-studies",
    name: "College of Basic Studies",
    routingType: "basicStudies",
    faculties: [
      {
        id: "basic-studies-programmes",
        name: "Basic Studies Programmes",
        departments: ["Remedial Studies", "IJMB", "Foundational Pathway Programmes"],
      },
    ],
  },
];

export function getCollegeById(collegeId) {
  return COLLEGES.find((c) => c.id === collegeId) || null;
}

export function getFaculty(collegeId, facultyId) {
  const college = getCollegeById(collegeId);
  if (!college) return null;
  return college.faculties.find((f) => f.id === facultyId) || null;
}
