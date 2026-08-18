export type EmploymentType = 'clt' | 'pj' | 'estagio' | 'aprendiz' | 'temporario' | 'freelancer';
export type WorkModel = 'presencial' | 'hibrido' | 'remoto';
export type JobApplicationStatus = 'interested' | 'viewed' | 'contacted' | 'withdrawn';

export interface JobPost {
  id: string;
  companyId: string;
  companyName: string;
  companyLogoUrl?: string;
  companyEmail?: string;
  companyWhatsapp?: string;
  companyWebsite?: string;
  title: string;
  description: string;
  requirements?: string;
  benefits?: string;
  salaryMin?: number;
  salaryMax?: number;
  employmentType: EmploymentType;
  workModel: WorkModel;
  location?: string;
  neighborhood?: string;
  locality?: string;
  latitude?: number;
  longitude?: number;
  locationPrecision?: 'exact' | 'reverse' | 'neighborhood';
  contactEmail?: string;
  contactWhatsapp?: string;
  contactEmailEnabled: boolean;
  contactWhatsappEnabled: boolean;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserResume {
  userId: string;
  email?: string;
  phone?: string;
  neighborhood?: string;
  objective?: string;
  experience?: string;
  education?: string;
  skills?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  userId: string;
  status: JobApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface JobFormData {
  title: string;
  description: string;
  requirements: string;
  benefits: string;
  salaryMin: string;
  salaryMax: string;
  employmentType: EmploymentType;
  workModel: WorkModel;
  location: string;
  neighborhood: string;
  locality?: string;
  latitude?: number;
  longitude?: number;
  contactEmail: string;
  contactWhatsapp: string;
  contactEmailEnabled: boolean;
  contactWhatsappEnabled: boolean;
  expiresAt: string;
}
