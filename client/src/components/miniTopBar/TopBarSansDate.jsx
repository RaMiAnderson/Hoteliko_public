import React from 'react'
import BasicButton from '../BasicButton/BasicButtons';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import MoreBtn from "../SettingTopBar/More"


import "./miniTopBar.css"
import { useTheme } from '../../context/themeContext';

export default function TopBarStatPG({titlePg}) {
  const {theme} = useTheme();
    const navigate = useNavigate();

  const is_newTicket = () => {
     navigate('/admin/new-ticket');  
  }
  return (
    <div className='mnTpBr_Parent' style={theme==="light" ? {backgroundColor:"var(--whiteBe)"} :{backgroundColor:"transparent"} }>
        <h3 className='titlePgStyle'>{titlePg}</h3> 
        <div className='mnTpBr_rightPrt'> 
            <div className='BtnNewTick'>
              <BasicButton 
                onClick={is_newTicket}
                variant={"contained"}
                color={"var(--white)"}
                bgColor={"#f87269"} 
                bgColorH={"#eb6258"} 
                bgColorA={"#E42417"} 
                brdrColor={"#f87269"}
                brdrColorH={"#eb6258"}
                textBtn={"Nouveau Ticket"} 
                width={200} 
                padding={"7.7px 12px 9px 3px"}  
                StartIcon={<AddIcon/>}>
              </BasicButton>
            </div>
            <div className='More'>
              <MoreBtn/>
            </div>
        </div>
    </div>
  )
}
