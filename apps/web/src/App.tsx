import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './router';
import { AuthProvider } from './lib/AuthContext';

const router = createBrowserRouter(routes);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
