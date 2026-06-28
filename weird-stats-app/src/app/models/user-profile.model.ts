export interface UserPlan {
  id: string;
  name: string;
  type: 'free' | 'pro';
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  plan: UserPlan;
}

export const DEFAULT_PLAN: UserPlan = {
  id: '123456',
  name: 'Basic',
  type: 'free',
};
