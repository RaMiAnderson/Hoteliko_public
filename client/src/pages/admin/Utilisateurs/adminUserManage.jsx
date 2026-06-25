import React from 'react'
import getUser from "../../../services/getUserFonction"
import { useState, useEffect } from 'react';
import { useAsyncError, useNavigate } from 'react-router-dom'

// style 
import "./adminUserManage.css"

import TopNavSansDt from "../../../components/miniTopBar/TopBarSansDate"


export default function adminUserManage() {
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
 
  const [usersData, setUsersData] = useState([]);

  if(token !== null)
    return (
      <>
        <div className='adminDashBoardParent'>
          <div className="UserManagecontentParent">
            {/* TopBar */}
            <div className='user_tpBrC'>
              <TopNavSansDt titlePg={"Mes employés"}/>
            </div>
            <div>
              {/* filter */}

            </div>
          </div>
        </div>
      </>
    )
}
