// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { test } from '@jupyterlab/galata';
import { expect } from '@playwright/test';
import { TestResult } from '@playwright/test/reporter';
import BenchmarkReporter, {
  benchmark,
  IReportRecord
} from '../../src/benchmarkReporter';
import fs from 'fs';
import path from 'path';
import { JSONObject } from '@lumino/coreutils';

const MOCK_DATA = {
  nSamples: 20,
  browser: 'chromium',
  file: 'large_code_notebook',
  project: 'benchmark',
  test: 'open',
  time: 18204,
  reference: 'actual'
};

const GENERAL_CONFIG = {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  description: 'Box plots of some action time.',
  title: 'Duration of common actions',
  data: {
    values: [{ x: 0, y: 0 }]
  },
  mark: 'bar'
};

function mockTestResult(
  attachments: {
    name: string;
    path?: string;
    body?: Buffer;
    contentType: string;
  }[]
): TestResult {
  return {
    retry: 0,
    workerIndex: 0,
    startTime: new Date(),
    duration: 0,
    status: 'passed',
    attachments,
    stdout: [],
    stderr: [],
    steps: []
  };
}

function createReporter(options?: {
  outputFile?: string;
  comparison?: 'snapshot' | 'project';
  vegaLiteConfigFactory?: (
    allData: Array<IReportRecord>,
    comparison: 'snapshot' | 'project'
  ) => JSONObject;
  textReportFactory?: (
    allData: Array<IReportRecord>
  ) => Promise<[string, string]>;
}): BenchmarkReporter {
  const rootDir = '../../';
  const reporter = new BenchmarkReporter(options);
  reporter.onBegin({ rootDir } as any, null);
  reporter.onTestEnd(
    null,
    mockTestResult([
      {
        name: benchmark.DEFAULT_NAME_ATTACHMENT,
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify(MOCK_DATA))
      }
    ])
  );
  return reporter;
}

test.describe('BenchmarkReporter', () => {
  test('should generate report with default builders', async () => {
    const reporter = createReporter({
      outputFile: 'test.json',
      comparison: 'snapshot'
    });
    await reporter.onEnd({ status: 'passed' });
    const outputJson = path.resolve('.', `benchmark-results`, 'test.json');
    const outputData = JSON.parse(fs.readFileSync(outputJson, 'utf-8'));
    expect(outputData['values'][0]['time']).toBe(MOCK_DATA['time']);

    const outputMd = path.resolve('.', `benchmark-results`, 'test.md');
    const mdData = fs.readFileSync(outputMd, 'utf-8');
    expect(mdData).toContain('## Benchmark report');

    const outputPng = path.resolve('.', `benchmark-results`, 'test.png');
    const pngData = fs.readFileSync(outputPng);
    expect(pngData).toMatchSnapshot('test.png');
  });

  test('should generate report with user defined builders', async () => {
    const reporter = createReporter({
      outputFile: 'test.json',
      comparison: 'snapshot',
      textReportFactory: async allData => ['## This is a custom table', 'txt'],
      vegaLiteConfigFactory: (allData, comparison) => GENERAL_CONFIG
    });
    await reporter.onEnd({ status: 'passed' });
    const outputMd = path.resolve('.', 'benchmark-results', 'test.txt');
    const mdData = fs.readFileSync(outputMd, 'utf-8');
    expect(mdData).toContain('## This is a custom table');

    const outputPng = path.resolve('.', 'benchmark-results', 'test.png');
    const pngData = fs.readFileSync(outputPng);
    expect(pngData).toMatchSnapshot('customized_test.png');
  });
});
