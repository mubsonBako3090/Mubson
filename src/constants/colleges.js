// KASU's 8 colleges, with their faculties and departments.
// Full official list as of 2026 – grouped by college and faculty.

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
        departments: ["Chemical Pathology", "Community Medicine", "Medical Microbiology & Parasitology"],
      },
      {
        id: "clinical-sciences",
        name: "Faculty of Clinical Sciences",
        departments: ["Surgery", "Internal Medicine", "Obstetrics & Gynaecology", "Paediatrics"],
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
        departments: [
          "Biological Sciences",
          "Biochemistry",
          "Microbiology",
          "Chemistry",
          "Physics",
          "Mathematical Sciences",
          "Statistics",
          "Geology",
          "Geophysics",
        ],
      },
      {
        id: "computing",
        name: "Faculty of Computing",
        departments: ["Computer Science", "Cyber Security", "Data Science", "Information Systems", "Software Engineering"],
      },
      {
        id: "engineering",
        name: "Faculty of Engineering",
        departments: ["Computer Engineering", "Electrical & Electronics Engineering", "Mechanical Engineering"],
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
        departments: [
          "Economics",
          "Political Science",
          "Sociology",
          "Geography",
          "Mass Communication",
          "Criminology & Security Studies",
          "International Relations & Diplomacy",
        ],
      },
      {
        id: "management-sciences",
        name: "Faculty of Management Sciences",
        departments: [
          "Accounting",
          "Business Administration",
          "Banking & Finance",
          "Public Administration",
          "Marketing",
          "Entrepreneurship",
          "Industrial Relations & Personnel Management",
        ],
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
        departments: [
          "English and Drama",
          "History",
          "Arabic",
          "Islamic Studies",
          "Christian Religious Studies",
          "French",
          "Hausa",
          "Linguistics",
          "Theatre Arts",
        ],
      },
      {
        id: "education",
        name: "Faculty of Education",
        departments: [
          "Science Education",
          "Arts Education",
          "Education & Biology",
          "Education & Chemistry",
          "Education & Physics",
          "Education & Mathematics",
          "Education & Economics",
          "Education & Geography",
          "Education & Arabic",
          "Education & Islamic Studies",
          "Education & Christian Religious Studies",
        ],
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
        departments: [
          "Agricultural Economics",
          "Animal Science",
          "Crop Protection",
          "Agricultural Extension & Rural Development",
          "Plant Protection",
          "Soil Science",
        ],
      },
      {
        id: "environmental-sciences",
        name: "Faculty of Environmental Sciences",
        departments: ["Architecture", "Estate Management", "Quantity Surveying", "Environmental Management", "Building"],
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
        departments: ["Remedial Studies", "IJMB", "Foundational Pathway Programmes", "Pre-Degree"],
      },
    ],
  },
];

// Helper functions (unchanged)
export function getCollegeById(collegeId) {
  return COLLEGES.find((c) => c.id === collegeId) || null;
}

export function getFaculty(collegeId, facultyId) {
  const college = getCollegeById(collegeId);
  if (!college) return null;
  return college.faculties.find((f) => f.id === facultyId) || null;
        }
