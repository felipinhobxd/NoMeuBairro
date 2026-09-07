import { expect, test, type Page } from '@playwright/test';

const companyId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const residentId = '11111111-2222-4333-8444-555555555555';
const jobId = '99999999-aaaa-4bbb-8ccc-dddddddddddd';
const applicationId = '77777777-aaaa-4bbb-8ccc-dddddddddddd';
const companyEmail = 'empresa@example.test';
const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYWFhYWFhYS1iYmJiLTRjY2MtOGRkZC1lZWVlZWVlZWVlZWUiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cCI6NDEwMjQ0NDgwMCwiYXVkIjoiYXV0aGVudGljYXRlZCIsImVtYWlsIjoiZW1wcmVzYUBleGFtcGxlLnRlc3QifQ.test';

function companyAuthUser() {
  const now = '2026-09-07T22:30:00.000Z';
  return {
    id: companyId,
    aud: 'authenticated',
    role: 'authenticated',
    email: companyEmail,
    email_confirmed_at: now,
    phone: '',
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: 'Empresa E2E', account_type: 'company' },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  };
}

async function prepareAuthenticatedCompany(page: Page) {
  await page.addInitScript(({ token, user, focusJobId }) => {
    localStorage.setItem('nmb-font-size-v1', 'medium');
    localStorage.setItem('anb-cookie-consent', 'essential');
    localStorage.setItem('nmb-onboarding-v6', 'done');
    localStorage.setItem('nmb-pwa-install-dismissed-at', String(Date.now()));
    localStorage.setItem('sb-127-auth-token', JSON.stringify({
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 4102444800,
      refresh_token: 'e2e-refresh-token',
      user,
    }));
    sessionStorage.setItem('anb-company-focus-job', focusJobId);
  }, { token: accessToken, user: companyAuthUser(), focusJobId: jobId });
}

test('notificação de interesse abre os candidatos da vaga correta', async ({ page }) => {
  const user = companyAuthUser();
  const profile = {
    id: companyId,
    name: 'Responsável Empresa E2E',
    avatar_url: null,
    reputation: 0,
    created_at: '2026-09-07T22:30:00.000Z',
  };
  const company = {
    id: companyId,
    company_name: 'Empresa E2E',
    description: 'Empresa usada somente no teste automatizado.',
    email: companyEmail,
    phone: null,
    whatsapp: null,
    website: null,
    address: null,
    neighborhood: 'Centro',
    public_email_enabled: false,
    public_phone_enabled: false,
    public_whatsapp_enabled: false,
    public_address_enabled: false,
  };
  const job = {
    id: jobId,
    company_id: companyId,
    title: 'Vaga E2E',
    description: 'Descrição demonstrativa da vaga E2E.',
    requirements: null,
    benefits: null,
    salary_min: null,
    salary_max: null,
    employment_type: 'clt',
    work_model: 'remoto',
    location: null,
    neighborhood: 'Centro',
    locality: null,
    latitude: null,
    longitude: null,
    location_precision: null,
    contact_email: companyEmail,
    contact_whatsapp: null,
    contact_email_enabled: true,
    contact_whatsapp_enabled: false,
    expires_at: '2027-01-01',
    is_active: true,
    created_at: '2026-09-07T22:31:00.000Z',
  };
  const application = {
    id: applicationId,
    job_id: jobId,
    user_id: residentId,
    status: 'interested',
    created_at: '2026-09-07T22:32:00.000Z',
    updated_at: '2026-09-07T22:32:00.000Z',
  };
  const resume = {
    user_id: residentId,
    email: 'candidato@example.test',
    phone: '(41) 99999-0000',
    neighborhood: 'Centro',
    objective: 'Atendimento ao cliente',
    experience: 'Experiência E2E',
    education: 'Ensino médio completo',
    skills: 'Atendimento, Excel',
    users: { name: 'Candidato E2E', avatar_url: null },
  };

  await page.route('**/supabase-mock/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const accept = request.headers().accept || '';
    const single = accept.includes('vnd.pgrst.object+json');
    const fulfill = async (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    });

    if (path.includes('/auth/v1/user')) return fulfill(user);
    if (path.endsWith('/rest/v1/users')) return fulfill(single ? profile : [profile]);
    if (path.endsWith('/rest/v1/app_roles')) return fulfill(single ? null : []);
    if (path.endsWith('/rest/v1/company_profiles')) return fulfill(single ? company : [company]);
    if (path.endsWith('/rest/v1/job_posts')) return fulfill([job]);
    if (path.endsWith('/rest/v1/job_applications')) return fulfill([application]);
    if (path.endsWith('/rest/v1/user_resumes')) return fulfill([resume]);
    return fulfill(single ? null : []);
  });

  await prepareAuthenticatedCompany(page);
  await page.goto('/#/empresa');

  await expect(page.getByRole('heading', { name: 'Empresa E2E' })).toBeVisible();
  const dialog = page.getByRole('dialog', { name: 'Interessados — Vaga E2E' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Candidato E2E')).toBeVisible();
  await expect(dialog.getByText('candidato@example.test')).toBeVisible();
  await expect(dialog.getByText('Atendimento ao cliente')).toBeVisible();
  await expect(dialog.getByText('Experiência E2E')).toBeVisible();
  await expect(page.evaluate(() => sessionStorage.getItem('anb-company-focus-job'))).resolves.toBeNull();
});
