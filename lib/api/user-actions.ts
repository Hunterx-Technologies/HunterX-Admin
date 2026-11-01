'use server';

import type { User } from '@/types/user';
import type { ApiResponse } from '@/types/api';
import { apiClient, unwrap } from '@/lib/api/client';
import { mapRawUserToUser } from '@/lib/api/user-mapper';
import { revalidatePath } from 'next/cache';

export async function banUser(id: string, reason?: string): Promise<User> {
  const trimmed = (reason ?? '').trim();
  const body = trimmed.length > 0 ? { reason: trimmed } : {};
  try {
    const raw = await unwrap(apiClient.patch<ApiResponse<{ user: any }>>(`/admin/users/${id}/ban`, body));
    revalidatePath('/users');
    revalidatePath(`/users/${id}`);
    return mapRawUserToUser(raw.user);
  } catch (error: any) {
    const status = error?.status || error?.response?.status;
    const message = error?.message || error?.response?.data?.message || 'Failed to ban user.';
    const err: any = new Error(message);
    err.status = status;
    throw err;
  }
}

export async function unbanUser(id: string): Promise<User> {
  try {
    const raw = await unwrap(apiClient.patch<ApiResponse<{ user: any }>>(`/admin/users/${id}/unban`));
    revalidatePath('/users');
    revalidatePath(`/users/${id}`);
    return mapRawUserToUser(raw.user);
  } catch (error: any) {
    const status = error?.status || error?.response?.status;
    const message = error?.message || error?.response?.data?.message || 'Failed to unban user.';
    const err: any = new Error(message);
    err.status = status;
    throw err;
  }
}

export async function adjustUserXp(id: string, delta: number, reason: string): Promise<User> {
  try {
    const raw = await unwrap(apiClient.post<ApiResponse<{ user: any }>>(`/admin/users/${id}/xp-adjustment`, { delta, reason }));
    revalidatePath('/users');
    revalidatePath(`/users/${id}`);
    return mapRawUserToUser(raw.user);
  } catch (error: any) {
    const status = error?.status || error?.response?.status;
    const message = error?.message || error?.response?.data?.message || 'Failed to adjust XP.';
    const err: any = new Error(message);
    err.status = status;
    throw err;
  }
}

export async function resetUserStreak(id: string): Promise<User> {
  try {
    const raw = await unwrap(apiClient.post<ApiResponse<{ user: any }>>(`/admin/users/${id}/reset-streak`));
    revalidatePath('/users');
    revalidatePath(`/users/${id}`);
    return mapRawUserToUser(raw.user);
  } catch (error: any) {
    const status = error?.status || error?.response?.status;
    const message = error?.message || error?.response?.data?.message || 'Failed to reset streak.';
    const err: any = new Error(message);
    err.status = status;
    throw err;
  }
}
