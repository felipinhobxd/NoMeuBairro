export type EmploymentType = 'clt' | 'pj' | 'estagio' | 'aprendiz' | 'temporario' | 'freelancer';
export type WorkModel = 'presencial' | 'hibrido' | 'remoto';

export interface CompanyProfile {
  id: string;
  companyName: string;
  description?: string;
  logoUrl?: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  address?: string;
  neighborhood?: string;
  createdAt: string;
  updatedAt: string;
}

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
  contactEmail?: string;
  contactWhatsapp?: string;
  contactEmailEnabled: boolean;
  contactWhatsappEnabled: boolean;
  isActive: boolean;
  expiresAt?: string;
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
  contactEmail: string;
  contactWhatsapp: string;
  contactEmailEnabled: boolean;
  contactWhatsappEnabled: boolean;
  expiresAt: string;
}
