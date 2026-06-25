import * as React from 'react';

import { DemoContainer } from '@mui/x-date-pickers/internals/demo';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useTheme } from '../../context/themeContext';
export default function ControlledComponent({ label, value, onChangeValue }) {
  const [internalValue, setInternalValue] = React.useState(null);
  const { theme } = useTheme();
  const currentValue = value !== undefined ? value : internalValue;

  const handleChange = (newValue) => {
    if (onChangeValue) {
      onChangeValue(newValue);
      return;
    }

    setInternalValue(newValue);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DemoContainer components={['DatePicker']}>
        <DatePicker
          format="DD-MM-YYYY"
          label={label}
          value={currentValue}
          
          onChange={handleChange}
          sx={{
            width: '200px', 
            "& .MuiInputBase-root": {
              height: '40px', 
              minHeight: '40px', 
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center', 
              overflow: 'hidden',
              lineHeight: '1.2',
              color: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
            },
            "& .MuiInputLabel-root": {
              fontSize: 'var(--basicText)', 
              top: '-4px',
              color: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
            },
            "& .MuiOutlinedInput-input":{
                top:"10px",
                fontSize:"var(--basicText)"
            },
            "& .MuiInputLabel-shrink":{
              top:"2px",
              fontSize: '15px',
            },
           
            
            "& .MuiOutlinedInput-root": {
              height: '40px', 
              minHeight: '40px',
              "& fieldset": {
                borderColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
              },
              "&:hover fieldset": {
                borderColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
              },
              "&.Mui-focused fieldset": {
                borderColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteKely)",
              },
              ".MuiSvgIcon-root":{
                color: theme == "light" ? "var(--noirbeBorder)" : "var(--whiteKely)"
              }
            },
            "& .MuiSvgIcon-root": {
              fontSize: '20px', 
    
            },
          }}
        />
      </DemoContainer>
    </LocalizationProvider>
  );
}

