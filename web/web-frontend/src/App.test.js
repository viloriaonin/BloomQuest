import { act, render, screen, within } from '@testing-library/react';
import { waitFor } from '@testing-library/react';
import App from './App';
import { API_URL } from './config/api';

jest.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="bar-chart" />,
  Doughnut: () => <div data-testid="doughnut-chart" />,
}));

const setupRoute = (path, role, authenticatedRole = role) => {
  window.history.pushState({}, '', path);
  localStorage.clear();
  localStorage.setItem('role', role);
  localStorage.setItem('token', 'test-token');
  global.fetch = jest.fn(async (url) => {
    const requestUrl = String(url);
    let payload = [];
    if (requestUrl.endsWith('/admin/me')) {
      payload = {
        role: authenticatedRole,
        name: 'Taylor Admin',
        email: 'taylor@example.edu',
        campus_name: 'Main Campus',
        department_id: 10,
      };
    } else if (requestUrl.endsWith('/academic-hierarchy')) {
      payload = {
        campuses: [{
          id: 1,
          name: 'Main Campus',
          departments: [{
            id: 10,
            name: 'Engineering',
            programs: [],
            faculty: [],
          }],
        }],
      };
    } else if (requestUrl.endsWith('/super-admin/overview')) {
      payload = {
        totals: {},
        campuses: [],
        bloom_distribution: {},
        question_type_distribution: {},
      };
    } else if (requestUrl.endsWith('/admin/campus-overview')) {
      payload = {
        totals: {},
        campuses: [],
        bloom_distribution: {},
        question_type_distribution: {},
      };
    }
    return { ok: true, json: async () => payload };
  });
};

test('renders the landing page by default', async () => {
  render(<App />);
  expect(await screen.findByText(/turn your course materials into/i)).toBeInTheDocument();
});

test('checks campus admin access through the configured API URL', async () => {
  window.history.pushState({}, '', '/admin/dashboard');
  localStorage.setItem('role', 'campus_admin');
  localStorage.setItem('token', 'test-token');
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    json: async () => String(url).endsWith('/admin/me') ? {
      role: 'campus_admin',
      name: 'Taylor Campus Admin',
      email: 'taylor@example.edu',
      campus_name: 'Main Campus',
    } : [],
  }));

  render(<App />);

  expect(await screen.findByRole('contentinfo', {}, { timeout: 5000 })).toHaveTextContent(/BloomQuest\. All rights reserved\./);
  expect(screen.getByRole('contentinfo').closest('.bq-page')).toBeInTheDocument();
  const dashboardFilter = await screen.findByRole('heading', { name: 'Dashboard filter' }, { timeout: 5000 });
  expect(dashboardFilter.closest('section')).not.toHaveClass('sticky');
  expect(await screen.findByText('Taylor Campus Admin', {}, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByText('Campus Admin - (Main Campus)')).toBeInTheDocument();
  expect(screen.getByText('taylor@example.edu')).toBeInTheDocument();

  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    `${API_URL}/admin/me`,
    expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }),
  ));

  localStorage.clear();
});

test('super admin can access the shared dashboard shell', async () => {
  setupRoute('/super-admin/dashboard', 'super_admin');

  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
  expect(screen.getByText('UNIVERSITY WORKSPACE')).toBeInTheDocument();
  const superAdminNavigation = within(screen.getByRole('navigation'));
  [
    'Dashboard',
    'Campus Management',
    'Admin Management',
    'Global Users',
    'Academic Management',
    'Question Bank',
    'AI Usage',
    'Activity Logs',
  ].forEach((label) => {
    expect(superAdminNavigation.getByRole('button', { name: label })).toBeInTheDocument();
  });
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    `${API_URL}/admin/me`,
    expect.objectContaining({
      cache: 'no-store',
    }),
  ));
  expect(superAdminNavigation.queryByRole('button', { name: 'User Management' })).not.toBeInTheDocument();
  expect(superAdminNavigation.queryByRole('button', { name: 'Reports' })).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/super-admin/dashboard');
});

test('does not render Super Admin content while /admin/me authorization is pending', async () => {
  window.history.pushState({}, '', '/super-admin/dashboard');
  localStorage.clear();
  localStorage.setItem('role', 'super_admin');
  localStorage.setItem('token', 'test-token');
  let resolveAdminMe;
  global.fetch = jest.fn((url) => {
    if (String(url).endsWith('/admin/me')) {
      return new Promise((resolve) => { resolveAdminMe = resolve; });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });

  render(<App />);

  expect(await screen.findByText('Checking admin access…')).toBeInTheDocument();
  expect(screen.queryByText('UNIVERSITY WORKSPACE')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Global Users' })).not.toBeInTheDocument();

  await act(async () => {
    resolveAdminMe({
      ok: true,
      json: async () => ({ role: 'super_admin' }),
    });
  });
  expect(await screen.findByText('UNIVERSITY WORKSPACE')).toBeInTheDocument();
});

test.each([
  ['network rejection', () => Promise.reject(new Error('Network unavailable'))],
  ['HTTP 401', () => Promise.resolve({ ok: false, status: 401, json: async () => ({}) })],
  ['HTTP 403', () => Promise.resolve({ ok: false, status: 403, json: async () => ({}) })],
  ['malformed JSON', () => Promise.resolve({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } })],
  ['missing role', () => Promise.resolve({ ok: true, json: async () => ({ name: 'Taylor' }) })],
  ['unrecognized role', () => Promise.resolve({ ok: true, json: async () => ({ role: 'faculty' }) })],
])('%s fails closed on a Super Admin route', async (_scenario, adminMeResponse) => {
  window.history.pushState({}, '', '/super-admin/dashboard');
  localStorage.clear();
  localStorage.setItem('role', 'super_admin');
  localStorage.setItem('token', 'test-token');
  global.fetch = jest.fn((url) => (
    String(url).endsWith('/admin/me')
      ? adminMeResponse()
      : Promise.resolve({ ok: true, json: async () => ({}) })
  ));

  render(<App />);

  expect(await screen.findByText(/turn your course materials into/i)).toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
  expect(screen.queryByText('UNIVERSITY WORKSPACE')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Global Users' })).not.toBeInTheDocument();
  expect(localStorage.getItem('role')).toBeNull();
  expect(localStorage.getItem('token')).toBeNull();
});

test('does not repeat /admin/me verification during ordinary rerenders', async () => {
  setupRoute('/super-admin/dashboard', 'super_admin');

  const { rerender } = render(<App />);
  expect(await screen.findByText('UNIVERSITY WORKSPACE')).toBeInTheDocument();

  await act(async () => {
    rerender(<App />);
  });

  expect(global.fetch.mock.calls.filter(([url]) => String(url).endsWith('/admin/me'))).toHaveLength(1);
});

test.each(['campus_admin', 'admin'])(
  '%s is redirected from Super Admin routes to the campus admin dashboard',
  async (role) => {
    setupRoute('/super-admin/dashboard', role);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Dashboard filter' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/dashboard');
  },
);

test.each([
  ['campus_admin', 'Dashboard filter', '/admin/dashboard'],
  ['admin', 'Dashboard filter', '/admin/dashboard'],
  ['department_admin', 'Programs you manage', '/admin/academic'],
])(
  'does not trust a forged Super Admin local role when the authenticated role is %s',
  async (authenticatedRole, expectedHeading, expectedPath) => {
    setupRoute('/super-admin/dashboard', 'super_admin', authenticatedRole);

    render(<App />);

    expect(await screen.findByRole('heading', { name: expectedHeading })).toBeInTheDocument();
    expect(window.location.pathname).toBe(expectedPath);
    expect(screen.queryByRole('button', { name: 'Global Users' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activity Logs' })).not.toBeInTheDocument();
    expect(localStorage.getItem('role')).toBe(authenticatedRole);
  },
);

test('uses the authenticated Super Admin role when local storage has a stale campus role', async () => {
  setupRoute('/super-admin/dashboard', 'campus_admin', 'super_admin');

  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/super-admin/dashboard');
  expect(localStorage.getItem('role')).toBe('super_admin');
});

test('department admin is redirected to the Department Admin dashboard', async () => {
  setupRoute('/super-admin/dashboard', 'department_admin');

  render(<App />);

  expect(await screen.findByText('Programs you manage')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/admin/academic');
});

test('Super Admin base route redirects to the shared dashboard shell', async () => {
  setupRoute('/super-admin', 'super_admin');

  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/super-admin/dashboard');
});

test('admin base route redirects to the Campus Admin dashboard', async () => {
  setupRoute('/admin', 'campus_admin');

  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Dashboard filter' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/admin/dashboard');
});

test('Super Admin is redirected from admin routes to its dashboard', async () => {
  setupRoute('/admin/dashboard', 'super_admin');

  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/super-admin/dashboard');
});

test.each([
  ['campus_admin', '/admin/academic/campus/1/department/10/program/100', 'Academic Management'],
  ['campus_admin', '/admin/questions/20', 'Question Bank'],
  ['super_admin', '/super-admin/academic/campus/1/department/10/program/100', 'Academic Management'],
  ['super_admin', '/super-admin/questions', 'Question Bank'],
  ['super_admin', '/super-admin/dashboard', 'Dashboard'],
  ['department_admin', '/admin/questions/20', 'Question Bank'],
])('%s retains dashboard selection for deep link %s', async (role, path, heading) => {
  setupRoute(path, role);

  render(<App />);

  expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
  expect(window.location.pathname).toBe(path);
});

test.each([
  ['campus_admin', '/super-admin/academic/campus/1', 'Dashboard filter', '/admin/dashboard'],
  ['admin', '/super-admin/questions', 'Dashboard filter', '/admin/dashboard'],
  ['super_admin', '/admin/academic/campus/1', 'Dashboard', '/super-admin/dashboard'],
])('%s is redirected from restricted deep link %s', async (role, path, heading, redirectPath) => {
  setupRoute(path, role);

  render(<App />);

  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  expect(window.location.pathname).toBe(redirectPath);
});

test('allows a campus-assigned legacy admin through the admin guard', async () => {
  window.history.pushState({}, '', '/admin/dashboard');
  localStorage.setItem('role', 'admin');
  localStorage.setItem('token', 'test-token');
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ role: 'admin' }),
  }));

  render(<App />);

  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    `${API_URL}/admin/me`,
    expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }),
  ));
  expect(localStorage.getItem('role')).toBe('admin');

  localStorage.clear();
});
