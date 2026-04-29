import {
  API_BASE,
  api,
  clearToken,
  createApiError,
  getCachedGet,
  getToken,
  invalidateCachedGets,
  parseApiErrorResponse,
  type GetRequestOptions,
} from '../core';
import type { V2ReportDetail,V2ReportListItem,V2ReportVariant } from './types';
export async function listReportsV2(
  ennusteId?: string,
  options?: GetRequestOptions,
): Promise<V2ReportListItem[]> {
  const query = ennusteId ? `?ennusteId=${encodeURIComponent(ennusteId)}` : '';
  return getCachedGet(
    `GET /v2/reports${query}`,
    () => api<V2ReportListItem[]>(`/v2/reports${query}`),
    options,
  );
}

export async function createReportV2(data: {
  ennusteId?: string;
  vesinvestPlanId: string;
  title?: string;
  variant?: V2ReportVariant;
  locale?: 'en' | 'fi' | 'sv';
}): Promise<{
  reportId: string;
  title: string;
  createdAt: string;
  baselineYear: number;
  requiredPriceToday: number;
  requiredAnnualIncreasePct: number;
  totalInvestments: number;
  variant: V2ReportVariant;
  pdfUrl: string;
}> {
  const result = await api<{
    reportId: string;
    title: string;
    createdAt: string;
    baselineYear: number;
    requiredPriceToday: number;
    requiredAnnualIncreasePct: number;
    totalInvestments: number;
    variant: V2ReportVariant;
    pdfUrl: string;
  }>('/v2/reports', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  invalidateCachedGets('GET /v2/reports');
  return result;
}

export async function getReportV2(id: string): Promise<V2ReportDetail> {
  return api<V2ReportDetail>(`/v2/reports/${id}`);
}

export function getReportPdfUrlV2(id: string): string {
  return `${API_BASE}/v2/reports/${id}/pdf`;
}

export async function downloadReportPdfV2(id: string): Promise<{
  blob: Blob;
  filename: string;
}> {
  const token = getToken();
  const res = await fetch(getReportPdfUrlV2(id), {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) {
    const message = 'Session expired. Please log in again.';
    clearToken('expired', message);
    throw new Error(message);
  }

  if (!res.ok) {
    const parsed = await parseApiErrorResponse(res);
    throw createApiError(res.status, parsed);
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get('content-disposition') ?? '';
  const utf8Name = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quotedName = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1];
  const rawName = utf8Name ? decodeURIComponent(utf8Name) : quotedName;
  const filename =
    rawName && rawName.toLowerCase().endsWith('.pdf')
      ? rawName
      : `report-${id}.pdf`;

  return { blob, filename };
}
