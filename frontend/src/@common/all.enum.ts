export enum YesNoEnum {
  Yes = "Yes",
  No = "No",
}

export enum SubjectTypeEnum {
  TH = "TH",
  IN = "IN",
  IN_TH = "IN_TH",
}

export enum CourseTypeEnum {
  Compulsory = "Compulsory",
  Optional = "Optional",
}

export enum StatusEnum {
  Active = "Active",
  Inactive = "Inactive",
}

export enum WeekDaysEnum {
  Sunday = "Sunday",
  Monday = "Monday",
  Tuesday = "Tuesday",
  Wednesday = "Wednesday",
  Thursday = "Thursday",
  Friday = "Friday",
  Saturday = "Saturday",
}

export enum EnableStatusEnum {
  Enabled = "Enabled",
  Disabled = "Disabled",
}

export enum GenderEnum {
  Male = "Male",
  Female = "Female",
  Other = "Other",
  Unknown = "Unknown",
}

export enum MaritalStatusEnum {
  Single = "Single",
  Married = "Married",
}

export enum ImagableTypeEnum {
  image = "image",
  video = "video",
}

export enum BloodGroupEnum {
  A_POSITIVE = "A+",
  B_POSITIVE = "B+",
  B_NEGATIVE = "B-",
  AB_POSITIVE = "AB+",
  A_NEGATIVE = "A-",
  O_POSITIVE = "O+",
  O_NEGATIVE = "O-",
  Unknown = "Unknown",
}

export enum NationalityEnum {
  Nepali = "Nepali",
  Indian = "Indian",
  Other = "Other",
}

export enum ReligionEnum {
  Hindu = "Hindu",
  Buddhist = "Buddhist",
  Muslim = "Muslim",
  Other = "Other",
}

export enum CasteEnum {
  Brahmin = "Brahmin",
  Chhetri = "Chhetri",
  Dalits = "Dalits",
  Gurung = "Gurung",
  Tamang = "Tamang",
  Magar = "Magar",
  Limbu = "Limbu",
  Rai = "Rai",
  Rajput = "Rajput",
  Vaishya = "Vaishya",
  Tharu = "Tharu",
  Other = "Other",
}

export enum EthnicGroupEnum {
  // Hill Ethnic Groups
  Gurung = "Gurung",
  Magar = "Magar",
  Tamang = "Tamang",
  Rai = "Rai",
  Limbu = "Limbu",
  Sherpa = "Sherpa",
  Thakali = "Thakali",
  Bhujel = "Bhujel",

  // Mountain Ethnic Groups
  Bhutia = "Bhutia",
  Larke = "Larke",
  Walung = "Walung",
  Dolpo = "Dolpo",
  Byasi = "Byasi",

  // Terai/Madhesi Ethnic Groups
  Tharu = "Tharu",
  Maithil = "Maithil",
  Rajbanshi = "Rajbanshi",
  Satar = "Satar",
  Dhimal = "Dhimal",
  Koch = "Koch",

  // Newar Community
  Shrestha = "Shrestha",
  Maharjan = "Maharjan",
  Vajracharya = "Vajracharya",
  Shakya = "Shakya",
  Manandhar = "Manandhar",
  Kumale = "Kumale",

  // Other Indigenous Groups
  Chepang = "Chepang",
  Baramu = "Baramu",
  Kusunda = "Kusunda",
  Hayu = "Hayu",
  Raji = "Raji",
  Majhi = "Majhi",
}

export enum DisabilityTypeEnum {
  NoDisability = "No Disability",
  // Physical Disabilities
  Physical = "Physical",
  Mobility = "Mobility",
  Visual = "Visual",
  Hearing = "Hearing",
  Speech = "Speech",

  // Intellectual and Cognitive Disabilities
  Intellectual = "Intellectual",
  Cognitive = "Cognitive",
  Learning = "Learning",

  // Psychological and Mental Disabilities
  Psychological = "Psychological",
  MentalHealth = "Mental Health",

  // Developmental Disabilities
  AutismSpectrumDisorder = "Autism Spectrum Disorder",
  DownSyndrome = "Down Syndrome",

  // Chronic Illness and Health-Related Disabilities
  ChronicIllness = "Chronic Illness",
  Neurological = "Neurological",
  Epilepsy = "Epilepsy",

  // Other Types of Disabilities
  MultipleDisabilities = "Multiple Disabilities",
  Other = "Other",
}

export enum NepaliMonthEnum {
  Baishak = "Baishak",
  Jestha = "Jestha",
  Ashad = "Ashad",
  Shrawan = "Shrawan",
  Bhadra = "Bhadra",
  Ashoj = "Ashoj",
  Kartik = "Kartik",
  Mangsir = "Mangsir",
  Poush = "Poush",
  Magh = "Magh",
  Falgun = "Falgun",
  Chaitra = "Chaitra",
}

export enum EnglishMonthEnum {
  January = "January",
  February = "February",
  March = "March",
  April = "April",
  May = "May",
  June = "June",
  July = "July",
  August = "August",
  September = "September",
  October = "October",
  November = "November",
  December = "December",
}

export enum DrCrEnum {
  Dr = "Dr",
  Cr = "Cr",
}

export enum FileTypeEnum {
  PDF = "application/pdf",
  JPEG = "image/jpeg",
  PNG = "image/png",
  GIF = "image/gif",
  MP3 = "audio/mpeg",
  MP4 = "video/mp4",
  ZIP = "application/zip",
  DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

export enum FileCategoryEnum {
  Image = "Image",
  Video = "Video",
  Audio = "Audio",
  Document = "Document",
  Archive = "Archive",
  Other = "Other",
}

export enum ReportQueryTimePeriodEnum {
  Daily = "Daily",
  Weekly = "Weekly",
  Monthly = "Monthly",
  Yearly = "Yearly",
}

export enum AttendanceState {
  Present = "Present",
  Absent = "Absent",
  Leave = "Leave",
}

export enum ImportingAppTypeEnum {
  Veda = "Veda",
  Sikshya = "Sikshya",
  BrightSchool = "BrightSchool",
}

// Mirrors AttendanceSourceEnum in the school backend (src/common/enums/all.enum.ts) -
// which channel is authoritative for a device's attendance log ingestion.
export enum AttendanceSourceEnum {
  Cloud = "cloud",
  Local = "local",
}

// Mirrors ServerTargetModeEnum in the school backend - which of
// server_ip+server_port vs server_host_name is currently the active target
// value on an attendance device. Both write to the same device field
// (ICLOCKSVRURL); this just picks which app-level value is active.
export enum ServerTargetModeEnum {
  Ip = "ip",
  Hostname = "hostname",
}
