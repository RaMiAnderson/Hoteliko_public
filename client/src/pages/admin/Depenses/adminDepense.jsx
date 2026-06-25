import React from 'react'
import getUser from "../../../services/getUserFonction"
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'

// style 
import "./adminDepense.css"

import MiniTopBar from "../../../components/miniTopBar/TopBarStatPG"
 

export default function adminDepense() {
  const navigate = useNavigate();

  const [token, setToken] = useState(sessionStorage.getItem("user"));
  if(token !== null){
      const [userDataSRC, setUserDataSRC] = useState(getUser.getDataUser(token));
      const d = userDataSRC.then(async (data) => await setUserData((data)))
      const [userData, setUserData] = useState();
      
      useEffect(() => {
          if(userData != undefined){
              if(userData.fonction !== "Admin")
                  navigate("/")
          }
      })
  }
  else
    useEffect(() => {navigate("/")})
 

  if(token !== null)
    return (
      <>
        <div className='adminDashBoardParent'>
          <div className="DepensecontentParent">
            {/* TopBar */}
            <div className='dep_tpBrC'>
                <MiniTopBar titlePg={"Nos Dépenses"}/>
            </div>
          </div>
        </div>
      </>
    )
}
