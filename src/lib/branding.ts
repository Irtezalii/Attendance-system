// Institutional identity and image assets, in one place so they are easy to replace.
//
// Images live in public/assets/branding/. To change one, copy the new file there
// (with a proper extension such as .png or .jpg) and update its path below.

export const branding = {
  universityName: "University of Karachi",
  instituteName: "Umair Basha Institute of Information Technology",
  instituteShort: "UBIT",
  departmentName: "Department of Computer Science",
  appName: "Student Attendance System",
  logo: {
    src: "/assets/branding/Logo.png",
    alt: "University of Karachi",
  },
  loginBackground: {
    src: "/assets/branding/ubit-campus.png",
  },
} as const;
