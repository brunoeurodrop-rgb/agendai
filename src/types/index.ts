export type UserRole = 'owner' | 'admin' | 'professional'
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type PlanType = 'starter' | 'pro' | 'enterprise' | 'trial'
export type MessageType = 'confirmation' | 'reminder_24h' | 'reminder_1h' | 'cancellation' | 'rescheduling'

export interface Organization {
  id: string
  name: string
  slug: string
  plan: PlanType
  phone: string | null
  address: string | null
  logo_url: string | null
  created_at: string
  trial_ends_at: string | null
}

export interface Profile {
  id: string
  org_id: string
  email: string
  name: string
  role: UserRole
  phone: string | null
  avatar_url: string | null
  created_at: string
}

export interface Professional {
  id: string
  org_id: string
  name: string
  specialty: string | null
  phone: string | null
  email: string | null
  bio: string | null
  active: boolean
  avatar_url: string | null
  created_at: string
}

export interface Service {
  id: string
  org_id: string
  name: string
  description: string | null
  duration_min: number
  price: number
  active: boolean
  color: string | null
  created_at: string
}

export interface Customer {
  id: string
  org_id: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  created_at: string
}

export interface Appointment {
  id: string
  org_id: string
  customer_id: string
  professional_id: string
  service_id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  notes: string | null
  wa_confirmation_sent: boolean
  wa_reminder_24h_sent: boolean
  wa_reminder_1h_sent: boolean
  created_at: string
  customer?: Customer
  professional?: Professional
  service?: Service
}

export interface Availability {
  id: string
  professional_id: string
  weekday: number
  start_time: string
  end_time: string
  active: boolean
}

export interface MessageLog {
  id: string
  org_id: string
  appointment_id: string
  type: MessageType
  phone: string
  message: string
  status: 'sent' | 'failed' | 'pending'
  sent_at: string | null
  created_at: string
}

export interface DashboardMetrics {
  todayAppointments: number
  pendingAppointments: number
  confirmedAppointments: number
  todayRevenue: number
  monthRevenue: number
  newCustomersThisMonth: number
  cancellationsToday: number
}
