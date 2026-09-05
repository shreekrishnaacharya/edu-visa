let exclude_feature: string[] = [];
if (
  location.hostname == "nrsa.acharyatech.com" ||
  location.hostname == "localhost"
) {
  exclude_feature = [
    // "/dashboard",
    // "/student/certificate",
    // "/student/setting",
    // "/account",
    // // "/vehicle",
    // "/library",
    // "/inventory",
  ];
}

export { exclude_feature };
