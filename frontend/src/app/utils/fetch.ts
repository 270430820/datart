/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { message } from 'antd';
import {
  DownloadTask,
  DownloadTaskState,
} from 'app/pages/MainPage/slice/types';
import { ExecuteToken } from 'app/pages/SharePage/slice/types';
import ChartDataRequest, {
  transformToViewConfig,
} from 'app/types/ChartDataRequest';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { ChartDTO } from 'app/types/ChartDTO';
import { filterSqlOperatorName } from 'app/utils/internalChartHelper';
import { saveAs } from 'file-saver';
import { request, request2, requestWithHeader } from 'utils/request';
import { errorHandle } from 'utils/utils';

export const getDistinctFields = async (
  viewId: string,
  columns: string[],
  view: ChartDTO['view'] | undefined,
  executeToken: ExecuteToken | undefined,
) => {
  const viewConfigs = transformToViewConfig(view?.config);
  const requestParams: ChartDataRequest = {
    aggregators: [],
    filters: [],
    groups: [],
    columns: [...new Set(columns)],
    pageInfo: {
      pageNo: 1,
      pageSize: 99999999,
      total: 99999999,
    },
    orders: [],
    keywords: ['DISTINCT'],
    viewId,
    ...viewConfigs,
  };
  if (executeToken) {
    const { data } = await request<ChartDataSetDTO>({
      method: 'POST',
      url: `share/execute`,
      params: {
        executeToken: executeToken?.token,
        password: executeToken?.password,
      },
      data: requestParams,
    });
    return filterSqlOperatorName(requestParams, data);
  } else {
    const { data } = await request<ChartDataSetDTO>({
      method: 'POST',
      url: `data-provider/execute`,
      data: requestParams,
    });
    return filterSqlOperatorName(requestParams, data);
  }
};

export const makeDownloadDataTask =
  (params: {
    downloadParams: ChartDataRequest[];
    fileName: string;
    resolve: () => void;
  }) =>
  async () => {
    const { downloadParams, fileName, resolve } = params;
    const res = await request<{}>({
      url: `download/submit/task`,
      method: 'POST',
      data: {
        downloadParams: downloadParams,
        fileName: fileName,
      },
    });
    if (res?.success) {
      message.success('下载任务创建成功');
    }
    resolve();
  };
// TODO
export const makeShareDownloadDataTask =
  (params: {
    resolve: () => void;
    clientId: string;
    fileName: string;
    downloadParams: ChartDataRequest[];
    shareToken: string;
    executeToken?: Record<string, ExecuteToken>;
    password?: string | null;
  }) =>
  async () => {
    const {
      downloadParams,
      fileName,
      resolve,
      executeToken,
      clientId,
      password,
      shareToken,
    } = params;
    const { success } = await request<{}>({
      url: `share/download`,
      method: 'POST',
      data: {
        downloadParams,
        fileName: fileName,
        executeToken,
        password,
        shareToken,
      },
      params: {
        clientId,
      },
    });
    if (success) {
      message.success('下载任务创建成功');
    }
    resolve();
  };

export async function checkComputedFieldAsync(sourceId, expression) {
  const _removeSquareBrackets = expression => {
    if (!expression) {
      return '';
    }
    return expression.replaceAll('[', '').replaceAll(']', '');
  };
  const response = await request<boolean>({
    method: 'POST',
    url: `data-provider/function/validate`,
    params: {
      sourceId,
      snippet: _removeSquareBrackets(expression),
    },
  });
  return !!response?.data;
}

export async function fetchFieldFunctionsAsync(sourceId) {
  const response = await request<string[]>({
    method: 'POST',
    url: `data-provider/function/support/${sourceId}`,
  });
  return response?.data;
}

export async function generateShareLinkAsync(
  expiryDate,
  usePassword,
  vizId,
  vizType,
) {
  const response = await request<{
    data: { password: string; token: string; usePassword: boolean };
    errCode: number;
    message: string;
    success: boolean;
  }>({
    method: 'POST',
    url: `share`,
    data: {
      expiryDate: expiryDate,
      usePassword: usePassword,
      vizId: vizId,
      vizType,
    },
  });
  return response?.data;
}

export const dealFileSave = (data, headers) => {
  const fileNames = /filename[^;\n=]*=((['"]).*?\2|[^;\n]*)/g.exec(
    headers?.['content-disposition'] || '',
  );
  const encodeFileName = decodeURIComponent(fileNames?.[1] || '');
  const blob = new Blob([data], { type: '**application/octet-stream**' });
  saveAs(blob, String(encodeFileName?.replaceAll('"', '')) || 'unknown.xlsx');
};

export async function downloadFile(id) {
  const [data, headers] = (await requestWithHeader({
    url: `download/files/${id}`,
    method: 'GET',
    responseType: 'blob',
  })) as any;
  dealFileSave(data, headers);
}

export async function fetchPluginChart(path) {
  const result = await request(path, {
    baseURL: '/',
    headers: { Accept: 'application/javascript' },
  }).catch(error => {
    console.error(error);
  });
  return result || '';
}

export async function getChartPluginPaths() {
  const response = await request<string[]>({
    method: 'GET',
    url: `plugins/custom/charts`,
  });
  return response?.data || [];
}

export async function loadShareTask(params) {
  try {
    const { data } = await request2<DownloadTask[]>({
      url: `/share/download/task`,
      method: 'GET',
      params,
    });
    const isNeedStopPolling = !(data || []).some(
      v => v.status === DownloadTaskState.CREATED,
    );
    return {
      isNeedStopPolling,
      data: data || [],
    };
  } catch (error) {
    errorHandle(error);
    throw error;
  }
}
interface DownloadShareDashChartFileParams {
  downloadId: string;
  shareToken: string;
  password?: string | null;
}
export async function downloadShareDataChartFile(
  params: DownloadShareDashChartFileParams,
) {
  const [data, headers] = (await requestWithHeader({
    url: `share/download`,
    method: 'GET',
    responseType: 'blob',
    params,
  })) as any;
  dealFileSave(data, headers);
}
