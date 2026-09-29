import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the landing page by default', () => {
  render(<App />);
  expect(screen.getByText(/turn your course materials into/i)).toBeInTheDocument();
});
