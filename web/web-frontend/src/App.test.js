import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the login screen by default', () => {
  render(<App />);
  expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  expect(screen.getByText(/sign in to access your student portal/i)).toBeInTheDocument();
});
