export type AnalysisResult = { success: boolean; description: string; objects: Array<{ name: string; confidence: number }>; environment: string; insights: string; confidence: 'low'|'medium'|'high' }; 
export type User = { id: string; name: string; email: string; avatarUrl?: string | null; createdAt?: string };
