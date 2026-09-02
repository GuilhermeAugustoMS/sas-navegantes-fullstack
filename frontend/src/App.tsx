import { CatalogProvider } from "./context/CatalogContext";
import { CrudPage } from "./pages/CrudPage";

function App() {
  return (
    <CatalogProvider>
      <CrudPage />
    </CatalogProvider>
  );
}

export default App;
