import React, {useEffect, useState} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import logout from "../../services/logout"

// Icons
import DashBoardIco from "@mui/icons-material/InsertChartOutlinedOutlined"
import ArticleIco from "@mui/icons-material/DescriptionOutlined"
import ChambreIco from "@mui/icons-material/HotelOutlined"
import ClientIco from "@mui/icons-material/ContactPageOutlined"
import InventoryIcon from "@mui/icons-material/Inventory2Outlined"
import ApprovIco from "@mui/icons-material/ArchiveOutlined"
import DepenseIco from "@mui/icons-material/PriceChangeOutlined"
import UserIco from "@mui/icons-material/BadgeOutlined"
import DecoIco from "@mui/icons-material/LogoutOutlined"
import Toggle from "@mui/icons-material/CompareArrowsOutlined"

import bonHomm from "../../assets/img/Principale/userPers.png"
import appIco from "../../assets/ico/hotel-sign.ico"

 
//Style
import "./navBarStyle.css"
import { useTheme } from '../../context/themeContext'

export default function AdminNavbar() {
  const {theme} = useTheme()
  
  const navigate = useNavigate();
  const location = useLocation();
  
  const [indexActivList, setIndexActivList] = useState(0);
  const [isToggleActive, setInverseToggle] = useState(true);

  useEffect(() => {
    const pathname = location.pathname;

    if (pathname === "/admin/new-ticket") {
      setIndexActivList(0);
      return;
    }
    if (pathname.startsWith("/admin/dashboard")) {
      setIndexActivList(1);
      return;
    }
    if (pathname.startsWith("/admin/articles")) {
      setIndexActivList(2);
      return;
    }
    if (pathname.startsWith("/admin/chambres") || pathname.startsWith("/admin/fournisseurs")) {
      setIndexActivList(3);
      return;
    }
    if (pathname.startsWith("/admin/clients")) {
      setIndexActivList(4);
      return;
    }
    if (pathname.startsWith("/admin/ventes")) {
      setIndexActivList(5);
      return;
    }
    if (pathname.startsWith("/admin/ravitaillements")) {
      setIndexActivList(6);
      return;
    }
    if (pathname.startsWith("/admin/depenses")) {
      setIndexActivList(7);
      return;
    }
    if (pathname.startsWith("/admin/utilisateurs")) {
      setIndexActivList(8);
      return;
    }

    setIndexActivList(1);
  }, [location.pathname])

  let ifClick = (index) => {
    setIndexActivList(index);
    switch(index){
      case 1 :
        if(location.pathname == "/admin/dashboard")
        {}
        else
          navigate("/admin/dashboard");
        break;
      case 2 :
        if(location.pathname == "/admin/articles")
        {}
        else
          navigate("/admin/articles");
        break;
      case 3 :
        if(location.pathname == "/admin/chambres")
        {}
        else
          navigate("/admin/chambres");
        break;
      case 4 :
        if(location.pathname == "/admin/clients")
        {}
        else
          navigate("/admin/clients");
        break;
      case 5 :
        if(location.pathname == "/admin/ventes")
        {}
        else
          navigate("/admin/ventes");
        break;
      case 6 :
        if(location.pathname == "/admin/ravitaillements")
        {}
        else
          navigate("/admin/ravitaillements");
        break;
      case 7 :
        if(location.pathname == "/admin/depenses")
        {}
        else
          navigate("/admin/depenses");
        break;
      case 8 :
        if(location.pathname == "/admin/utilisateurs")
        {}
        else
          navigate("/admin/utilisateurs");
        break;
      case 9 : {
        let resultLogout = logout();
        window.location.reload();
      }
    }
  }

  const activeToggle = () => {
    setInverseToggle(!isToggleActive);
  }
  
  return (
    <>
        <div className = {`parentNavbar ${isToggleActive ? "Active-Toggle" : ""}`}  style={theme==="light" ? {backgroundColor:"rgb(29, 29, 29)"} :{backgroundColor:"rgb(29, 29, 29)"} } >
          {/* LOGO */}
          <div className="logoSection">
            <div className='logoFile'><img src={appIco} /></div>
            <p>Hotel'iko</p>
          </div>

          <div className="toggleSection">
            <button onClick={() => activeToggle()} className='btnToggle'><Toggle sx={{width:30, height:30}}/></button>
          </div>

          {/* InfoUser */}
          <div className="userInfoSection">
            <div className='userIcon'>
              <img src={bonHomm} alt="" />
            </div>
            <div className='nameContainer'>
              <p>Jeremie Dian</p>
              <p className='fonction'>Administrateur</p>
            </div>
          </div>

          {/* Link section  */}
          <div className="linkSection">
            <ul>
              
                <li className={`${indexActivList === 1 ? "selected" : ""}`} onClick={() => ifClick(1)} >
                  <div className="iconList"><DashBoardIco sx={{width: 27, height:27}} /></div>
                  <div className="nameList">Statistique</div>
                </li>
      
                <li className={`${indexActivList === 2 ? "selected" : ""}`} onClick={() => ifClick(2)}>
                  <div className="iconList"><ArticleIco sx={{width: 27, height:27}}/></div>
                  <div className="nameList">Articles</div>
                </li>
         
        
                <li className={`${indexActivList === 3 ? "selected" : ""}`} onClick={() => ifClick(3)}>
                  <div className="iconList"><ChambreIco sx={{width: 27, height:27}}/></div>
                  <div className="nameList">Chambres</div>
                </li>
           
                <li className={`${indexActivList === 4 ? "selected" : ""}`} onClick={() => ifClick(4)}>
                  <div className="iconList"><ClientIco sx={{width: 27, height:27}}/></div>
                  <div className="nameList">Clients</div>
                </li>
            
                <li className={`${indexActivList === 5 ? "selected" : ""}`} onClick={() => ifClick(5)}>
                  {/* liste des stock, date dernier reaprovisionemt, qt */}
                  <div className="iconList"><InventoryIcon sx={{width: 27, height:27}}/></div>
                  <div className="nameList">Ventes</div>
                </li>
         
                <li className={`${indexActivList === 6 ? "selected" : ""}`} onClick={() => ifClick(6)}>
                  {/* mampiditr qt article */}
                  <div className="iconList"><ApprovIco sx={{width: 27, height:27}}/></div>
                  <div className="nameList">Ravitaillements</div>
                </li>
           
                <li className={`${indexActivList === 7 ? "selected" : ""}`} onClick={() => ifClick(7)}>
                  <div className="iconList"><DepenseIco sx={{width: 27, height:27}}/></div>
                  <div className="nameList">Dépenses</div>
                </li>
            
                <li className={`${indexActivList === 8 ? "selected" : ""}`} onClick={() => ifClick(8)}>
                  <div className="iconList"><UserIco sx={{width: 27, height:27}}/></div>
                  <div className="nameList">Utilisateurs</div>
                </li>
          
            </ul>

          </div>

          {/* section deco */}
            <hr className='separateLogout'/>
            <div className={`logoutSection ${indexActivList === 9 ? "selected" : ""}`} onClick={() => ifClick(9)}>
              <div ><DecoIco sx={{width: 27, height:27}}/></div>
              <div className='nameList'>Déconnexion</div>
            </div>

        </div>
    </>
  )
}
