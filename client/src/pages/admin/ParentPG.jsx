import React from 'react'
import { useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import useRealtimeEvents from '../../services/useRealtimeEvents';

import { Outlet } from 'react-router-dom'


//style
import "./ParentPg.css"

//navBar
import NavbAdmin from "../../components/Navbar/AdminNavbar"

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

const ParentPG = () => {
    const API_URL = import.meta.env.VITE_API_URL;
    const lastAlertAtRef = useRef(new Map());
    const lastRealtimeCheckRef = useRef(0);

    const checkLowStockArticles = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/api/articles/all`);
            if (response.status !== 200 || !Array.isArray(response.data)) return;

            const now = Date.now();
            const lowStockArticles = response.data.filter((article) => {
                const qt = Number(article.qt);
                const seuil = Number(article.seuil);
                return Number.isFinite(qt) && Number.isFinite(seuil) && qt <= seuil;
            });

            const activeKeys = new Set();

            lowStockArticles.forEach((article) => {
                const key = String(article.id ?? article.designation);
                activeKeys.add(key);

                const lastAt = lastAlertAtRef.current.get(key) || 0;
                if (now - lastAt >= ALERT_COOLDOWN_MS) {
                    toast.error(`Alerte ${article.designation} presque epuisee`, {
                        id: `low-stock-${key}`,
                        duration: 5000
                    });
                    lastAlertAtRef.current.set(key, now);
                }
            });

            [...lastAlertAtRef.current.keys()].forEach((key) => {
                if (!activeKeys.has(key)) {
                    lastAlertAtRef.current.delete(key);
                }
            });
        } catch (err) {
            console.log("Erreur verification seuil article:", err);
        }
    }, [API_URL]);

    useRealtimeEvents((event) => {
        if (!event || !["stock-updated", "articles-updated"].includes(event.type)) return;

        const now = Date.now();
        if (now - lastRealtimeCheckRef.current < 2000) return;

        lastRealtimeCheckRef.current = now;
        checkLowStockArticles();
    });

    useEffect(() => {
        checkLowStockArticles();
        const intervalId = setInterval(checkLowStockArticles, CHECK_INTERVAL_MS);

        return () => {
            clearInterval(intervalId);
        };
    }, [checkLowStockArticles]);

        return (
            <>
                <div className='adminParent'>
                    <div className="navParent"> 
                        <NavbAdmin/>
                    </div>
                    {/* <div className="contentParent">
                        <Outlet />
                    </div> */}
                    <div className="contentParent">
                        <Outlet />
                    </div>
                </div>
            </>
        )
}

export default ParentPG
