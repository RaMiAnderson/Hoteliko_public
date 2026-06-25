import React from 'react'
import { useTheme } from '../../context/themeContext';
import "./cardMoneyStyle.css"


const CardMoney = ({color, label, montant, stats}) => {
  const {theme} = useTheme();
  return (
    <> 
      <div className='cardMoneyParent'>
        <div className='leftColor' style={{backgroundColor:color}}></div>
        <div className='rightContent'>
          <div style={{display:"flex", justifyContent:"space-between", width:"100%"}}>
              <p className='label' style={{color: color}}>{label}</p>
              <p className='miniStat' style={{color: "var(--GreenThem)"}}>{stats}</p>
          </div>
          <p className='montant' style={ theme === "light" ? {color: "var(--noirbe)"} : {color: "var(--whiteBe)"}} >Ar {montant}</p>
        </div>
      </div>
    </>
  )
}

export default CardMoney