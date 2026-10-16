// Institutional identity and image assets, in one place so they are easy to replace.
//
// To use the official artwork: copy the files into public/assets/branding/ (for example
// ku-logo.png and ubit-campus.jpg) and point `logo.src` / `loginBackground.src` at them.
// The placeholders are deliberately generic and labelled; they are not the official logos.

export const branding = {
  universityName: "University of Karachi",
  instituteName: "Umair Basha Institute of Information Technology",
  instituteShort: "UBIT",
  departmentName: "Department of Computer Science",
  appName: "Student Attendance System",
  logo: {
    src: "/assets/branding/ku-logo-placeholder.svg",
    alt: "University of Karachi",
  },
  loginBackground: {
    src: "/assets/branding/campus-placeholder.svg",
  },
} as const;
