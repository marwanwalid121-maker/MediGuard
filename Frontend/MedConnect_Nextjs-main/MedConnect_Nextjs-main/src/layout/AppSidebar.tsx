"use client";
import React, { useEffect, useRef, useState,useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useUser } from "../context/UserContext";
import {
  BoxCubeIcon,
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  TableIcon,
  UserCircleIcon,
} from "../icons/index";


import { Users, FileText, ClipboardList, FlaskConical, Calendar,QrCode } from "lucide-react";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
  roles?: ("Admin" | "Hospital" | "Pharmacy" | "Patient")[]; // Optional roles array
};

// Base menu items - will be filtered by role
const allNavItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    subItems: [
      { name: "Admin Dashboard", path: "/admin-dashboard", pro: false },
      { name: "Hospital Dashboard", path: "/hospital-dashboard", pro: false },
      { name: "Pharmacy Dashboard", path: "/pharmacy-dashboard", pro: false },
      { name: "Patient Dashboard", path: "/patient-dashboard", pro: false },
    ],
  },
  {
    icon: <Users />,
    name: "Users",
    path: "/users",
    roles: ["Admin"], // Admin only
  },
  {
    icon: <UserCircleIcon />,
    name: "Analytics Logs",
    path: "/analytics-logs",
    roles: ["Admin"], // Admin only
  },
  {
    icon: <QrCode />,
    name: "Scan QRCode",
    path: "/scan-qrcode",
    roles: ["Hospital", "Pharmacy"], // Hospital and Pharmacy
  },
  {
    icon: <Users />,
    name: "Patients",
    path: "/patients",
    roles: ["Hospital"], // Hospital Staff only
  },
  {
    icon: <QrCode />,
    name: "My QRCode",
    path: "/my-qrcode",
    roles: ["Patient"], // Patient only
  },
  {
    icon: <Calendar />,
    name: "My Health Records",
    path: "/my-health-records",
    roles: ["Patient"], // Patient only
  },
  {
    icon: <ClipboardList />,
    name: "Prescription Queue",
    path: "/prescription-queue",
    roles: ["Pharmacy"], // Pharmacy only
  },


  {
    icon: <QrCode />,
    name: "Inventory",
    path: "/inventory",
    roles: ["Pharmacy"], // Pharmacy only
  },
];

const othersItems: NavItem[] = [
  // {
  //   icon: <PieChartIcon />,
  //   name: "Charts",
  //   subItems: [
  //     { name: "Line Chart", path: "/line-chart", pro: false },
  //     { name: "Bar Chart", path: "/bar-chart", pro: false },
  //   ],
  // },
  // {
  //   icon: <BoxCubeIcon />,
  //   name: "UI Elements",
  //   subItems: [
  //     { name: "Alerts", path: "/alerts", pro: false },
  //     { name: "Avatar", path: "/avatars", pro: false },
  //     { name: "Badge", path: "/badge", pro: false },
  //     { name: "Buttons", path: "/buttons", pro: false },
  //     { name: "Images", path: "/images", pro: false },
  //     { name: "Videos", path: "/videos", pro: false },
  //   ],
  // },
  // {
  //   icon: <PlugInIcon />,
  //   name: "Authentication",
  //   subItems: [
  //     { name: "Sign In", path: "/", pro: false },
  //     { name: "Sign Up", path: "/signup", pro: false },
  //   ],
  // },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { role } = useUser();
  const [displayName, setDisplayName] = useState<string>('');

  // Filter nav items based on role and customize dashboard submenu
  const getFilteredNavItems = (): NavItem[] => {
    if (!role) return [];
    
    return allNavItems
      .filter((item) => {
        // If no roles specified, show to all (shouldn't happen, but safety check)
        if (!item.roles) return true;
        // Check if current role is in the allowed roles
        return item.roles.includes(role);
      })
      .map((item) => {
        // Customize Dashboard submenu based on role
        if (item.name === "Dashboard" && item.subItems) {
          const dashboardMap: Record<string, { name: string; path: string }> = {
            Admin: { name: "Admin Dashboard", path: "/admin-dashboard" },
            Hospital: { name: "Hospital Dashboard", path: "/hospital-dashboard" },
            Pharmacy: { name: "Pharmacy Dashboard", path: "/pharmacy-dashboard" },
            Patient: { name: "Patient Dashboard", path: "/patient-dashboard" },
          };
          
          const dashboardItem = dashboardMap[role];
          if (dashboardItem) {
            return {
              ...item,
              subItems: [{ name: dashboardItem.name, path: dashboardItem.path, pro: false }],
            };
          }
        }
        return item;
      });
  };

  const navItems = getFilteredNavItems();

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-4">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group  ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={` ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200  ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // const isActive = (path: string) => path === pathname;
   const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    const storedHospitalName = localStorage.getItem('hospitalName');
    const storedPharmacyName = localStorage.getItem('pharmacyName');
    const storedPatientName = localStorage.getItem('patientName');
    
    if (storedHospitalName && role === 'Hospital') {
      setDisplayName(storedHospitalName);
    } else if (storedPharmacyName && role === 'Pharmacy') {
      setDisplayName(storedPharmacyName);
    } else if (storedPatientName && (role === 'Patient' || role === 'Admin')) {
      setDisplayName(storedPatientName);
    } else if (role === 'Admin') {
      setDisplayName('Ministry of Health');
    } else if (role === 'Hospital') {
      setDisplayName('Hospital');
    } else if (role === 'Pharmacy') {
      setDisplayName('Pharmacy');
    } else {
      setDisplayName('User');
    }
  }, [role]);

  useEffect(() => {
    // Check if the current path matches any submenu item
    let submenuMatched = false;
    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? navItems : othersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    // If no submenu item matches, close the open submenu
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname,isActive]);

  useEffect(() => {
    // Set the height of the submenu items when the submenu is opened
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex  ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <div>
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <img
                className="dark:hidden h-40 w-auto"
                src="/images/logo/logo.png"
                alt="Logo"
              />
              <img
                className="hidden dark:block h-40 w-auto"
                src="/images/logo/logo.png"
                alt="Logo"
              />
            </>
          ) : (
            <img
              src="/images/logo/smalllogo.png"
              alt="Logo"
              className="h-12 w-40"
            />
          )}
        </div>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar flex-1">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>

            <div className="">
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Others"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div>
          </div>
        </nav>
      </div>

      {/* Logged-in User Section */}
      {(isExpanded || isHovered || isMobileOpen) && pathname !== "/patient-dashboard" && pathname !== "/my-qrcode" && pathname !== "/prescriptions" && pathname !== "/my-health-records" && (
        <div className="pb-6 pt-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 flex items-center justify-center rounded-full h-10 w-10 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30">
              <span className="text-2xl">
                {role === 'Hospital' ? '🏭' : role === 'Pharmacy' ? '💊' : role === 'Patient' ? '👤' : '👤'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-white/90 truncate">
                {displayName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {role || 'Role'}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default AppSidebar;
