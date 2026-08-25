import axios, { AxiosError } from 'axios';

const GRAPH_BASE = 'https://graph.facebook.com';
const GRAPH_VERSION = 'v23.0';

export interface MetaLeadField {
  name?: string;
  values?: string[];
}

export interface MetaLeadDetails {
  id: string;
  created_time?: string;
  field_data?: MetaLeadField[];
  form_id?: string;
  ad_id?: string;
  platform?: string;
  campaign_id?: string;
}

function toMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const metaError = err.response?.data?.error as { message?: string } | undefined;
    return metaError?.message || err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export async function subscribePageToLeadgen(accessToken: string, pageId: string): Promise<boolean> {
  try {
    const { data } = await axios.post(
      `${GRAPH_BASE}/${GRAPH_VERSION}/${pageId}/subscribed_apps`,
      null,
      {
        params: {
          subscribed_fields: 'leadgen',
          access_token: accessToken,
        },
        timeout: 15_000,
      },
    );
    return Boolean(data?.success);
  } catch (err) {
    console.warn(`[meta-leads] Page subscription failed (${pageId}): ${toMessage(err)}`);
    return false;
  }
}

export async function fetchLeadDetails(accessToken: string, leadgenId: string): Promise<MetaLeadDetails | null> {
  try {
    const { data } = await axios.get(`${GRAPH_BASE}/${GRAPH_VERSION}/${leadgenId}`, {
      params: {
        fields: 'id,created_time,field_data,form_id,ad_id,platform,campaign_id',
        access_token: accessToken,
      },
      timeout: 15_000,
    });

    if (!data?.id) return null;
    return {
      id: String(data.id),
      created_time: data.created_time ? String(data.created_time) : undefined,
      field_data: Array.isArray(data.field_data) ? data.field_data : undefined,
      form_id: data.form_id ? String(data.form_id) : undefined,
      ad_id: data.ad_id ? String(data.ad_id) : undefined,
      platform: data.platform ? String(data.platform) : undefined,
      campaign_id: data.campaign_id ? String(data.campaign_id) : undefined,
    };
  } catch (err) {
    console.warn(`[meta-leads] Lead details fetch failed (${leadgenId}): ${toMessage(err)}`);
    return null;
  }
}
