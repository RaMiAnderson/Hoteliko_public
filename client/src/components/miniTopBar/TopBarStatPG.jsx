import React, { useEffect, useState } from 'react'
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BasicButton from '../BasicButton/BasicButtons';
import AddIcon from '@mui/icons-material/Add';
import MoreBtn from "../SettingTopBar/More"

import DateTest from "../inputDate/DatePicker"

import "./miniTopBar.css"
import { useTheme } from '../../context/themeContext';


export default function TopBarStatPG({titlePg, enableDateFilter = false, defaultRange = "day"}) {
  const {theme} = useTheme()
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [localStartDate, setLocalStartDate] = useState(dayjs());
  const [localEndDate, setLocalEndDate] = useState(dayjs());
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  useEffect(() => {
    if (!enableDateFilter) return;
    if (startDateParam && endDateParam) return;

    const today = dayjs();
    let startDateValue = today;
    let endDateValue = today;

    if (defaultRange === "week") {
      const dayIndex = today.day();
      const startOfWeek = dayIndex === 0
        ? today.subtract(6, "day")
        : today.subtract(dayIndex - 1, "day");
      startDateValue = startOfWeek;
      endDateValue = startOfWeek.add(6, "day");
    }
    const nextParams = new URLSearchParams(searchParams);

    if (!startDateParam) {
      nextParams.set("startDate", startDateValue.format("YYYY-MM-DD"));
    }
    if (!endDateParam) {
      nextParams.set("endDate", endDateValue.format("YYYY-MM-DD"));
    }

    setSearchParams(nextParams, { replace: true });
  }, [enableDateFilter, defaultRange, startDateParam, endDateParam, searchParams, setSearchParams]);

  useEffect(() => {
    if (enableDateFilter) return;

    if (!searchParams.has("startDate") && !searchParams.has("endDate")) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("startDate");
    nextParams.delete("endDate");
    setSearchParams(nextParams, { replace: true });
  }, [enableDateFilter, searchParams, setSearchParams]);

  const startDateValue = enableDateFilter
    ? (startDateParam && dayjs(startDateParam).isValid() ? dayjs(startDateParam) : dayjs())
    : localStartDate;
  const endDateValue = enableDateFilter
    ? (endDateParam && dayjs(endDateParam).isValid() ? dayjs(endDateParam) : dayjs())
    : localEndDate;

  const is_newTicket = () => {
     navigate('/admin/new-ticket');  
  }

  const onChangeStartDate = (newValue) => {
    if (!newValue || !newValue.isValid()) return;

    if (!enableDateFilter) {
      setLocalStartDate(newValue);
      return;
    }

    const formatted = newValue.format("YYYY-MM-DD");
    if (formatted === startDateParam) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("startDate", formatted);
    setSearchParams(nextParams, { replace: true });
  };

  const onChangeEndDate = (newValue) => {
    if (!newValue || !newValue.isValid()) return;

    if (!enableDateFilter) {
      setLocalEndDate(newValue);
      return;
    }

    const formatted = newValue.format("YYYY-MM-DD");
    if (formatted === endDateParam) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("endDate", formatted);
    setSearchParams(nextParams, { replace: true });
  };

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
            {enableDateFilter && (
              <>
                <div className='DateTest'>
                  <DateTest
                    label={"Date début"}
                    value={startDateValue}
                    onChangeValue={onChangeStartDate}
                  />
                </div>
                <div className='DateTest'>
                  <DateTest
                    label={"Date fin"}
                    value={endDateValue}
                    onChangeValue={onChangeEndDate}
                  />
                </div>
              </>
            )}
            <div className='More'>
              <MoreBtn/>
            </div>
        </div>
    </div>
  )
}
