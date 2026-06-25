import React from 'react';
import getUser from "../../../services/getUserFonction";
import { useState, useEffect } from 'react';
import { useNavigate, Outlet, useSearchParams } from 'react-router-dom';

import "./adminFourniss.css";
import TopNavWithDate from "../../../components/miniTopBar/TopBarStatPG";

export default function AdminFourniss() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [token] = useState(sessionStorage.getItem("user"));
	const [isAllowed, setIsAllowed] = useState(false);
	const [isCheckingAuth, setIsCheckingAuth] = useState(true);
	const isHistoryView = searchParams.get("view") === "history";
	const topBarTitle = isHistoryView ? "Historique des chambres" : "Gestion des chambres";

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
				<div className='adminFrournisseurParent'>
					<div className="FournisscontentParent">
						<div className='artcl_tpBrC'>
							<TopNavWithDate
								titlePg={topBarTitle}
								enableDateFilter={isHistoryView}
								defaultRange={isHistoryView ? "week" : "day"}
							/>
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
