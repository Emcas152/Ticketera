import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="footer">
      <div>© {{ year }} Sistema Tickets</div>
    </footer>
  `,
  styles: [`.footer{padding:20px;text-align:center;border-top:1px solid #eee;margin-top:24px;color:#666}`]
})
export class FooterComponent { year = new Date().getFullYear(); }
