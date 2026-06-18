import './globals.css';

export const metadata = {
  title: 'SignalEngine — Know Who to Reach Out to Today',
  description: 'Monitor LinkedIn profiles for job changes, promotions, and company signals. Surface the right accounts at the right time.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
