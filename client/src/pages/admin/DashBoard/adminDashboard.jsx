import React from 'react'
import getUser from "../../../services/getUserFonction"
import { useState, useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom'

//style
import "./DashboardStyle.css"
import MiniTopBar from "../../../components/miniTopBar/TopBarStatPG"

export default function adminDashboard() {
    const navigate = useNavigate();

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

    if (!isCheckingAuth && isAllowed) 
        return (
            <>
                <div className='adminDashBoardParent'>
                    <div className="DashcontentParent">
                        {/* TopBar */}
                        <div className='adDsh_tpBrC'>
                            <MiniTopBar titlePg={"Récapitulatif des ventes"} enableDateFilter={true}/>
                        </div>
                        <div className='Dashcontent'>
                            <Outlet />
                        </div>
                    </div>
                </div>
            </>
        )

    return null;



}
