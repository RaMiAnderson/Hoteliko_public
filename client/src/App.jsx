import React from 'react'

// Page 
import LoginUser from "./pages/Login/LoginUser.jsx"
import AdminnParent from "./pages/admin/ParentPG.jsx"
import AdminnDashboard from "./pages/admin/DashBoard/adminDashboard.jsx"
import AdminArticles from "./pages/admin/Articles/adminArticles.jsx"
import AdminClientP from "./pages/admin/ClientP/adminClientP.jsx"
import AdminDepense from "./pages/admin/Depenses/adminDepense.jsx"
import AdminFournsseur from "./pages/admin/Fournisseur/adminFourniss.jsx"
import AdminInventory from "./pages/admin/Inventaire/adminIventory.jsx"
import AdminRavitaill from "./pages/admin/Ravitaillement/adminRavitaillement.jsx"
import AdminU_Manage from "./pages/admin/Utilisateurs/adminUserManage.jsx"


// Dash COntent
import FirstPg from "./pages/content/dashBoard/dashBoardContent.jsx"

//Articles Content
import ContentFirstPg from "./pages/content/articles/articlesContent.jsx"

//Fournisseur Content
import FournisseurFirstPg from "./pages/content/Fournisseur/FournisseurListContent.jsx"

//ClientCOntent
import ClientFirstPg from "./pages/content/Client/ClientListContent.jsx"
import ClientTicketsContent from "./pages/content/Client/ClientTicketsContent.jsx"

//New Ticket
import AdminNewTicket from "./pages/admin/NewTicket/NewTicketPG.jsx"
import NewTicketFirstPG from "./pages/content/NewTicket/NewTicketContent.jsx"
import VentesListContent from "./pages/content/Ventes/VentesListContent.jsx";
import VenteTicketDetailContent from "./pages/content/Ventes/VenteTicketDetailContent.jsx";

// Style
import './App.css'
import { BrowserRouter, Routes ,Route, Navigate} from 'react-router-dom'

 const App = ()=>{
  return (
    <>
      <BrowserRouter>
        <Routes> 
          <Route path="/" element={<Navigate to={"/auth/login"} replace />} />
          <Route path="/auth/login" element={<LoginUser />} />
          <Route
            path="/auth"
            element={<Navigate to={"/auth/login"} replace />}
          />
          {/*<Route path="/admin" element={<Navigate to={"/admin/dashboard"} />} /> */}

          <Route path="/admin" element={<AdminnParent />}>
            {/* redirection */}
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminnDashboard />}>
              <Route path="" element={<FirstPg />} />
            </Route>
            <Route path="articles" element={<AdminArticles />}>
              <Route path="" element={<ContentFirstPg />}/>
            </Route>
            <Route path="fournisseurs" element={<AdminFournsseur />} >
				<Route path="" element={<FournisseurFirstPg />} />
			</Route>
            <Route path="chambres" element={<AdminFournsseur />} >
				<Route path="" element={<FournisseurFirstPg />} />
			</Route>
            <Route path="clients" element={<AdminClientP />} >
				<Route index element={<ClientFirstPg />} />
				<Route path=":clientId" element={<ClientTicketsContent />} />
			</ Route>
			{/* invetaire lasa liste vente */}
            <Route path="ventes" element={<AdminInventory />} >
				<Route index element={<VentesListContent />} />
				<Route path=":ticketId" element={<VenteTicketDetailContent />} />
			</Route>
            <Route path="ravitaillements" element={<AdminRavitaill />} />
            <Route path="depenses" element={<AdminDepense />} />
            <Route path="utilisateurs" element={<AdminU_Manage />} />
            <Route path="new-ticket" element={<AdminNewTicket />} >
              <Route path='' element={<NewTicketFirstPG />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
export default App
