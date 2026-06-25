import React from 'react'
import getUser from "../../../services/getUserFonction"
import { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom'

// style 
import "./adminIventory.css"

import TopNavSansDt from "../../../components/miniTopBar/TopBarSansDate"
 

export default function adminIventory() {
  const navigate = useNavigate();
  const location = useLocation();
  const isTicketDetailPage = location.pathname.startsWith("/admin/ventes/");
  const [token] = useState(sessionStorage.getItem("user"));
  const [isAllowed, setIsAllowed] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!token) {
          navigate("/");
          return;
        }

        const userData = await getUser.getDataUser(token);
        if (!userData || userData.fonction !== "Admin") {
          navigate("/");
          return;
        }

        setIsAllowed(true);
      } catch (err) {
        console.log("Erreur verification user:", err);
        navigate("/");
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [token, navigate]);

  if (!isCheckingAuth && isAllowed) {
    return (
      <>
        <div className='adminDashBoardParent'>
          <div className="InventorycontentParent">
            {/* TopBar */}
            <div className='inv_tpBrC'>
              <TopNavSansDt titlePg={isTicketDetailPage ? "Détail du ticket" : "Liste des ventes"} />
            </div>
            <div className="fournisseurContent">
              <Outlet />
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;

}
