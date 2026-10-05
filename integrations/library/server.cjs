'use strict';
const axios = require('axios');
const { JSDOM } = require('jsdom');
const core = require('../../js/library-core');
const Parser = new JSDOM('').window.DOMParser;
const client = axios.create({
  timeout: 14000, maxRedirects: 0, responseType: 'text',
  maxContentLength: 2 * 1024 * 1024,
  headers: { Accept: 'text/html' }, transformResponse: [value => value]
});

exports.requestLibrary = async (action, input) => {
  const params = action === 'search' ? core.normalizeSearch({
    ...input, onlyAvailable: input.onlyAvailable === true || input.onlyAvailable === 'true'
  }) : null;
  const url = params ? core.buildSearchUrl(params) : core.buildDetailUrl(input.id);
  let response;
  try { response = await core.withDeadline(() => client.get(url)); }
  catch { throw new Error('暂时无法连接学校图书馆，请稍后重试'); }
  const doc = core.browserDocument(response.data, Parser);
  return {
    ok: true, libraryRevision: core.REVISION,
    result: params ? core.parseSearch(doc, params) : core.parseDetail(doc, input.id)
  };
};
