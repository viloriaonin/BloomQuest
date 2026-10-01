import { render, screen } from '@testing-library/react';
import { waitFor } from '@testing-library/react';
import App from './App';
import { API_URL } from './config/api';

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
    json: async () => String(url).endsWith('/admin/me') ? { role: 'campus_admin' } : [],
  }));

  render(<App />);

  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    `${API_URL}/admin/me`,
    expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }),
  ));

  localStorage.clear();
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
