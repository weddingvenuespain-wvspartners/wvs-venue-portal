import crypto from 'crypto'

// ── Config ───────────────────────────────────────────────────────────────────

const ENDPOINTS = {
  test: {
    redirect: 'https://sis-t.redsys.es:25443/sis/realizarPago',
    rest:     'https://sis-t.redsys.es:25443/sis/rest/trataPeticionREST',
  },
  production: {
    redirect: 'https://sis.redsys.es/sis/realizarPago',
    rest:     'https://sis.redsys.es/sis/rest/trataPeticionREST',
  },
} as const

type Env = 'test' | 'production'

function getEnv(): Env {
  return (process.env.REDSYS_ENV === 'production') ? 'production' : 'test'
}

export function getRedirectUrl() {
  return ENDPOINTS[getEnv()].redirect
}

export function getRestUrl() {
  return ENDPOINTS[getEnv()].rest
}

function getMerchantKey(): string {
  const key = process.env.REDSYS_SECRET_KEY
  if (!key) throw new Error('REDSYS_SECRET_KEY not configured')
  return key
}

function getMerchantCode(): string {
  return process.env.REDSYS_MERCHANT_CODE ?? '999008881'
}

function getTerminal(): string {
  return process.env.REDSYS_TERMINAL ?? '001'
}

// ── Base64URL ────────────────────────────────────────────────────────────────

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(str: string): Buffer {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4 !== 0) b64 += '='
  return Buffer.from(b64, 'base64')
}

// ── Signing (HMAC_SHA512_V2) ─────────────────────────────────────────────────
// Algorithm from: pagosonline.redsys.es/desarrolladores-inicio/.../firmar-una-operacion/
//
// 1. Prepare key: truncate to 16 chars or pad with '0' to 16 chars
// 2. Diversify: AES-128-CBC(key, orderNumber, IV=zeros)
// 3. HMAC-SHA512(diversifiedKey, merchantParamsBase64Url)
// 4. Ds_Signature = base64url(hmac)

function diversifyKey(merchantKey: string, order: string): string {
  // Ensure key is exactly 16 characters
  const key16 = merchantKey.length > 16
    ? merchantKey.slice(0, 16)
    : merchantKey.padEnd(16, '0')

  const iv = Buffer.alloc(16, 0)
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key16, 'utf-8'), iv)
  cipher.setAutoPadding(true)
  const encrypted = Buffer.concat([cipher.update(order, 'utf-8'), cipher.final()])
  // Return as base64 STRING — HMAC key is this string, not raw bytes
  return encrypted.toString('base64')
}

export function signParams(merchantParamsB64: string, order: string): string {
  const key = getMerchantKey()
  const diversified = diversifyKey(key, order)
  const hmac = crypto.createHmac('sha512', diversified)
  hmac.update(merchantParamsB64)
  return toBase64Url(hmac.digest())
}

export function verifySignature(merchantParamsB64: string, receivedSignature: string): boolean {
  try {
    const paramsJson = fromBase64Url(merchantParamsB64).toString('utf-8')
    const params = JSON.parse(paramsJson)
    const order = params.Ds_Order || params.DS_MERCHANT_ORDER
    if (!order) return false

    const expected = signParams(merchantParamsB64, order)
    const a = Buffer.from(expected, 'utf-8')
    const b = Buffer.from(receivedSignature, 'utf-8')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ── Parameter encoding ───────────────────────────────────────────────────────

export function encodeMerchantParams(params: Record<string, string>): string {
  const json = JSON.stringify(params)
  return toBase64Url(Buffer.from(json, 'utf-8'))
}

export function decodeMerchantParams(b64: string): Record<string, string> {
  const json = fromBase64Url(b64).toString('utf-8')
  return JSON.parse(json)
}

// ── Order number generator ───────────────────────────────────────────────────
// Must be 4-12 alphanumeric, first 4 numeric

export function generateOrderNumber(): string {
  const now = Date.now().toString().slice(-10) // 10 numeric digits
  const rand = crypto.randomBytes(1).toString('hex') // 2 hex chars
  return now + rand // 12 chars total, first 4 always numeric
}

// ── Build redirect form data ─────────────────────────────────────────────────

type CreatePaymentParams = {
  amountCents: number
  order: string
  notificationUrl: string
  successUrl: string
  errorUrl: string
  merchantData?: string       // custom data echoed back (e.g. userId, planId)
  language?: string           // 1=Spanish, 2=English
  // Tokenization (COF) for first subscription payment
  requestToken?: boolean
}

export function buildRedirectFormData(opts: CreatePaymentParams) {
  const params: Record<string, string> = {
    DS_MERCHANT_AMOUNT:          String(opts.amountCents),
    DS_MERCHANT_ORDER:           opts.order,
    DS_MERCHANT_MERCHANTCODE:    getMerchantCode(),
    DS_MERCHANT_CURRENCY:        '978', // EUR
    DS_MERCHANT_TRANSACTIONTYPE: '0',   // Authorization (standard payment)
    DS_MERCHANT_TERMINAL:        getTerminal(),
    DS_MERCHANT_MERCHANTURL:     opts.notificationUrl,
    DS_MERCHANT_URLOK:           opts.successUrl,
    DS_MERCHANT_URLKO:           opts.errorUrl,
  }

  if (opts.merchantData) {
    params.DS_MERCHANT_MERCHANTDATA = opts.merchantData
  }

  if (opts.language) {
    params.DS_MERCHANT_CONSUMERLANGUAGE = opts.language
  }

  // Request tokenization for recurring subscription
  if (opts.requestToken) {
    params.DS_MERCHANT_IDENTIFIER = 'REQUIRED'
    params.DS_MERCHANT_COF_INI    = 'S'
    params.DS_MERCHANT_COF_TYPE   = 'R' // Recurring
  }

  const merchantParamsB64 = encodeMerchantParams(params)
  const signature = signParams(merchantParamsB64, opts.order)

  return {
    Ds_SignatureVersion:    'HMAC_SHA512_V2',
    Ds_MerchantParameters: merchantParamsB64,
    Ds_Signature:          signature,
    // Helper: the URL to POST this form to
    redsysUrl:             getRedirectUrl(),
  }
}

// ── Build MIT (recurring charge) REST request ────────────────────────────────

type RecurringChargeParams = {
  amountCents: number
  order: string
  token: string             // Ds_Merchant_Identifier from CIT response
  cofTxnId: string          // Ds_Merchant_Cof_Txnid from CIT response
  merchantUrl?: string      // notification URL for the result
}

export function buildMitRequest(opts: RecurringChargeParams) {
  const params: Record<string, string> = {
    DS_MERCHANT_AMOUNT:          String(opts.amountCents),
    DS_MERCHANT_ORDER:           opts.order,
    DS_MERCHANT_MERCHANTCODE:    getMerchantCode(),
    DS_MERCHANT_CURRENCY:        '978',
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_TERMINAL:        getTerminal(),
    DS_MERCHANT_IDENTIFIER:      opts.token,
    DS_MERCHANT_COF_TXNID:       opts.cofTxnId,
    DS_MERCHANT_COF_TYPE:        'R',
    DS_MERCHANT_EXCEP_SCA:       'MIT',
    DS_MERCHANT_DIRECTPAYMENT:   'true',
  }

  if (opts.merchantUrl) {
    params.DS_MERCHANT_MERCHANTURL = opts.merchantUrl
  }

  const merchantParamsB64 = encodeMerchantParams(params)
  const signature = signParams(merchantParamsB64, opts.order)

  return {
    Ds_SignatureVersion:    'HMAC_SHA512_V2',
    Ds_MerchantParameters: merchantParamsB64,
    Ds_Signature:          signature,
  }
}

// ── Response helpers ─────────────────────────────────────────────────────────

export function isResponseAuthorized(responseCode: string): boolean {
  const code = parseInt(responseCode, 10)
  return code >= 0 && code <= 99
}
